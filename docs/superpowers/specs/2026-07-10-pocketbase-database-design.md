# PocketBase Database Design — PDFERPV2

**Date:** 2026-07-10
**Status:** Awaiting user approval
**Stack:** PocketBase (Go binary, SQLite + admin UI)

## 1. Goal

Replace the in-memory mock data with a real database so:
- Quotations persist across reloads/browsers
- The "current company" profile (logo, header, bank info) is editable, not hardcoded
- Master data (parties, items, staff) can be CRUD-ed
- A "Connect Document" action can later copy/link a saved doc into a fresh one
- All this without writing a custom backend

## 2. Storage Strategy: Snapshot + Link

Documents are stored as **JSON snapshots** — when you save a quotation, the entire document body (header, party, line items, totals, signatures, terms, payment info) is serialized into a `data` column. Re-opening a saved doc shows it as-it-was, even if the underlying items/parties have since been edited.

When a new doc is created from an existing one ("Connect Document"), we **store a `parent_id` link AND copy the data** into the new snapshot. The new doc is fully independent afterward — the link is for audit/lookup only. Rationale: lightweight (one row per doc, no joins to render), safe (edits to one doc never affect another), and aligns with the user's downstream requirement of pulling historical data into fresh docs.

## 3. Collections (PocketBase Schema) — LOCKED v1

Each field below was confirmed with the user. Anything not listed is explicitly **out of scope** and will be added later as an additive change (see section 10).

### 3.1 Master data (CRUD)

| Collection | Fields |
|---|---|
| `companies` | `name`, `address`, `phone`, `email`, `npwp`, `logo` (file) |
| `bank_accounts` | `company` (relation→companies), `bank_name`, `account_number`, `account_name`, `branch`, `swift_code`, `currency` (always `IDR` for now, future-proofing), `is_default` |
| `parties` | `name`, `type` (customer/supplier/both), `address`, `contact_person`, `phone`, `email`, `npwp`, `notes` |
| `items` | `code`, `name`, `category` (plat/siku/hollow/pipa/kanal/besi beton/wiremesh/etc), `unit` (kg/lembar/batang/m2/m3), `description`, `notes` |
| `prices` | `item` (relation→items), `company` (relation→companies), `buy_per_unit`, `sell_per_unit`, `valid_from`, `valid_to` |
| `staff` | `name`, `role`, `phone`, `email` |
| `app_state` | singleton: `key` (text, unique), `value` (json) — stores `active_company_id`, future UI prefs |

### 3.2 Documents (snapshot)

| Collection | Fields |
|---|---|
| `documents` | `doc_no`, `type` (text, free-form — see section 10), `direction` (jual/beli), `status` (draft/sent/paid/cancelled), `revision_count`, `parent_id` (relation→documents, optional), `issue_date`, `due_date`, `company` (relation→companies), `party` (relation→parties), `payment_terms`, `shipping_address`, `notes`, `data` (JSON — full document snapshot), `created`, `updated` |
| `document_lines` | `document` (relation→documents), `line_no`, `item_code`, `item_name`, `qty`, `unit`, `unit_price`, `buy_per_unit`, `discount_pct`, `line_total` |

### 3.3 Authentication

PocketBase built-in auth, single admin user for now (the user). No public signup. Admin UI at `/_/`.

## 4. `comp_logo` — Current Logo

The "current logo" displayed in the document header comes from the **active company**. The active company is stored as a singleton row in `app_state` (key=`active_company_id`).

- `app_state.active_company_id` is fetched on page load
- Frontend looks up the matching `companies` record → reads `logo` file
- Logo URL: `${POCKETBASE_URL}/api/files/companies/{id}/{filename}`
- Renders as `<img :src="activeCompany.logo_url">` in `.doc__head`
- Switching company (admin UI for now): update `app_state.value.active_company_id`, frontend re-fetches on next load

**Bank info for the T&C section** comes from `bank_accounts` filtered by `company = activeCompanyId` and `is_default = true` (or the first one if no default set).

## 5. Frontend Integration

```
src/
  lib/
    db.ts           # PocketBase client singleton + auth helpers
    api/
      companies.ts  # CRUD for companies
      parties.ts
      items.ts
      prices.ts
      staff.ts
      documents.ts
      appState.ts
  state/
    dbStore.ts      # company/party/item/staff state + load/save actions
```

The existing `src/data/*.ts` mock data files become "seed data" loaded into PocketBase on first run, then deleted.

## 6. File Storage

- Logos: PocketBase `file` field on `companies`, max 2MB, served via PocketBase's `/api/files/companies/{id}/{filename}` URL
- Display: `<img :src="activeCompany.logo_url">` in `.doc__head`
- Upload UI: in admin UI for now (no frontend upload form this iteration)

## 7. Data Flow

```
[Save quotation]
  ↓
docStore.save() → collect full doc body → JSON.stringify → documents.create({data: ...})
  ↓
[Load saved quotation]
  ↓
documents.getById(id) → JSON.parse(data) → render into doc body fields
  ↓
[Connect Document] (future)
  ↓
new doc = clone of parent.data + parent_id link, then user edits
```

## 8. Migration Plan

1. Install PocketBase binary, run on `:8090`
2. Create collections via admin UI (or `pb_migrations` JS files)
3. Add PocketBase JS SDK to `package.json` (`pocketbase` npm package)
4. Create `src/lib/db.ts` with client singleton
5. Create `src/state/dbStore.ts` with `loadCompanies`, `loadParties`, `loadItems`, `loadStaff`, `setActiveCompany`
6. Wire `app_state.active_company_id` to a fetch on page load
7. Render `activeCompany.logo` in `.doc__head`
8. Seed mock data into PocketBase on first run
9. Verify TypeScript compiles, run smoke test
10. Switch dev URL from `localhost:5173` → `localhost:5173` (Vite stays), add nginx proxy for `:8090` if needed

## 9. Out of Scope (this iteration)

- Frontend forms for company/party/item CRUD (use admin UI for now)
- Frontend logo upload (use admin UI for now)
- Document revision history UI (PocketBase stores it, no UI yet)
- Multi-user auth (single admin)
- "Connect Document" UI (schema supports it, UI later)
- Search/filter on saved documents list (sidebar shows the chip list — admin UI for browsing)
- `delivery` document type (schema supports it; UI later)
- Image/PDF attachments (will land as a new `attachments` collection, additive — see below)

## 10. Evolvability — Future Additive Changes

The schema is designed to evolve **by addition only** — no breaking changes to existing collections. The two key design choices that enable this:

- **`documents.type` is a free-form text field, not a constrained enum.** Adding a new document type (e.g., `delivery`, `credit_note`, `invoice_paid`) is a TS union extension only — no PocketBase migration, no row rewrites. The admin UI / partials / business rules pick up the new type from the union.

- **`documents.data` is a free-form JSON column.** When a new field is needed in the document body (e.g., a `surat_jalan` block for delivery notes, a `received_at` timestamp, a `driver_name` text field), it gets serialized into `data` on next save. Zero migration. Reads handle missing keys gracefully (treat as undefined → empty).

### Planned future additions (no schema rewrite needed)

| Feature | Schema change | Migration risk | Status |
|---|---|---|---|
| Add `delivery` document type | TS union: add `"delivery"` to `DocumentType` | None — `type` accepts any string | Planned (UI later) |
| Delivery-specific fields (driver, vehicle plate, receiver, POD timestamp) | None — go into `data` JSON | None | Planned |
| Image/PDF upload per document (delivery photos, signed POD, faktur pajak PDF) | New `attachments` collection: `document` (relation), `kind` (photo/pdf/signature), `file`, `uploaded_at` | Low — purely additive | Planned |
| Image/PDF upload per line item (product datasheet) | Add optional `line` (relation→document_lines) to `attachments` | Low — purely additive | Planned |
| `tax_invoice_number` (faktur pajak) on documents | Add column to `documents` (nullable text) | Low — additive, optional | Unconfirmed |
| Multi-currency transactions (`exchange_rate` on documents) | Add `currency` + `exchange_rate` columns | Low — additive, optional | Future-proofing only (always IDR today) |
| Multi-company support | `documents.company` already a relation; UI for company switcher added later | None — schema ready | Planned (UI later) |
| Customer/supplier payment tracking | New `payments` collection: `document`, `method`, `amount`, `paid_at`, `proof` (file), `reference_no` | Low — purely additive | Planned |
| Line-level fields (lot_no, weight_kg, dimensions, batch_no, expiry, delivery_date) | Add columns to `document_lines` (all optional) | Low — additive, optional | Available when needed (currently stored ad-hoc in `data` JSON) |
| Frontend CRUD forms for companies/parties/items/staff/prices | None — pure UI work | None | Planned |
| Document revision history UI | None — PocketBase stores history | None | Planned |
| Search/filter on saved documents | None — query layer | None | Planned |

The rule: **anything that needs to be queried/reported goes in a typed column in a typed collection. Anything that's "just data on this doc" goes in `data` JSON.**
