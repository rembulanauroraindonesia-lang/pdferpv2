# Deal Tracker Dashboard Design

> **Status:** Approved 2026-07-11

**Goal:** Build a Dashboard view called "Deal Tracker" that monitors locked deals from Sales Order creation through to Invoice, tracking both the Jual (customer) and Beli (supplier) chains with real-time HPP and margin per deal.

**Architecture:** Derived read-only view. No new collections. Deals are computed from existing `documents[]` where `type === 'sales_order'` AND `status === 'sent'`. Chain progress is resolved by traversing `parent_doc_id` links and matching `type` + `direction`. HPP and margin are computed from `documentLines` + `line.pricing` on the linked documents.

**Tech Stack:** Alpine.js store (`dealStore`), htmx partial (`deal-tracker.html`), CSS (`dashboard.css`)

## Global Constraints

- No new schema collections. Deal Tracker is 100% derived from `documents`, `documentLines`, `parties`, `staff`.
- Deal = Sales Order with `status === 'sent'` (locked via Simpan).
- Chain Jual: SO → PFI (jual) → Delivery (jual) → Invoice (jual)
- Chain Beli: PO (beli) → PFI (beli) → Delivery (beli) → Invoice (beli)
- Chain links resolved via `parent_doc_id` traversal from the SO.
- Chain Beli docs may not have `parent_doc_id` linking back to SO — they are matched by `party_id` + `direction === 'beli'` + type ordering.
- All labels in Bahasa Indonesia.
- Card-based layout (one card per deal).
- Mockup phase: in-memory data only. No persistence.

## Card Layout (per deal)

```
┌─────────────────────────────────────────┐
│  PT Gandasari · SO/RAI/26/0001         │  ← customer name + SO doc_no
│  12 Mei 2026 · Budi Santoso            │  ← SO date + marketing staff
│                                         │
│  Nilai Deal    Rp 4.512.000.000        │  ← totalSell from SO lines
│  HPP           Rp 4.034.900.000        │  ← totalBuy from SO line pricings
│  Margin        Rp 477.100.000 (11.8%)  │  ← margin + pct
│                                         │
│  Chain Jual  ● ○ ○ ○                   │  ← SO(done) PFI(delivery) Del(inv)
│              SO → PFI → DEL → INV       │
│                                         │
│  Chain Beli  ○ ○ ○ ○                   │  ← PO PFI DEL INV
│              PO → PFI → DEL → INV       │
│                                         │
│  ● Done  ◐ Draft  ○ Belum              │  ← legend
└─────────────────────────────────────────┘
```

### Chain Step Indicators

- **● Filled** (green/accent) = document exists with `status === 'sent'`
- **◐ Half** (amber) = document exists with `status === 'draft'`
- **○ Empty** (gray) = document not yet created

### Data Per Card (7 fields)

1. Customer name (from `party_id` → `parties.name`)
2. SO doc_no
3. SO date (formatted Indonesian)
4. Marketing staff name (from `marketingStaffId` → `staff.name`)
5. Nilai Deal = `sum(qty * unit_price)` across SO lines
6. HPP = `sum(qty * pricing.buy_per_unit)` across SO lines
7. Margin = Nilai Deal - HPP, plus margin%

## Chain Resolution Algorithm

### Chain Jual (customer side)

Starting from the SO document:

1. SO = the deal itself (always exists, always `sent` since deal = locked SO)
2. PFI Jual = find document where `type === 'proforma_invoice'` AND `direction === 'jual'` AND `parent_doc_id === SO.id`
3. Delivery Jual = find document where `type === 'delivery'` AND `direction === 'jual'` AND `parent_doc_id === PFI_Jual.id` (or `parent_doc_id === SO.id` if no PFI)
4. Invoice Jual = find document where `type === 'invoice'` AND `direction === 'jual'` AND `parent_doc_id === Delivery_Jual.id` (or walk back to find the closest parent)

### Chain Beli (supplier side)

The Beli chain is for procurement — purchasing from suppliers to fulfill the SO. These docs may not have `parent_doc_id` pointing to the SO. Match by `party_id` (same customer context? No — Beli is about suppliers, not the customer). 

Actually: Chain Beli docs are purchase orders TO SUPPLIERS. They don't link to the SO via `parent_doc_id`. They are matched by temporal proximity + the fact that they exist in the system. For the mockup, Chain Beli resolution is:

1. PO Beli = find document where `type === 'po'` AND `direction === 'beli'` (any — for mockup, all beli POs show on all deals, or we match by SO's line items' supplier_ids)
2. PFI Beli = `type === 'proforma_invoice'` AND `direction === 'beli'`
3. Delivery Beli = `type === 'delivery'` AND `direction === 'beli'`
4. Invoice Beli = `type === 'invoice'` AND `direction === 'beli'`

For mockup v1: Chain Beli shows whether ANY beli docs of each type exist. Refined matching (by supplier, by item, by date proximity) is a future enhancement.

### Future: Smart Chain Beli Matching

When PocketBase lands, Chain Beli can be linked to a deal via:
- `parent_doc_id` on PO pointing to SO (explicit link)
- Or matching `supplier_id` from SO line pricings to PO `party_id`
- Or a `deal_id` field on all documents

For now (mockup): simple existence check per type+direction.

## Files to Create/Modify

| File | Action | Responsibility |
|------|--------|----------------|
| `src/state/dealStore.ts` | Create | Alpine store with `deals` getter, chain resolver, HPP/margin calc |
| `public/partials/deal-tracker.html` | Create | Card-based dashboard partial |
| `src/styles/dashboard.css` | Create | Card styles, chain progress indicators |
| `index.html` | Modify | Add "Dashboard" nav group above "Dokumen Jual", Deal Tracker link, route to deal-tracker partial |
| `src/state/shellStore.ts` | Modify | Add `deal-tracker` to label map, handle activeView |
| `src/components/documentView.ts` | Modify | Route `deal-tracker` view to load deal-tracker.html partial (not a doc type, no $store.doc.setType) |
| `src/main.ts` | Modify | Register `dealStore` store |

## Sidebar Placement

```
DASHBOARD
  ◆ Deal Tracker              ← NEW

DOKUMEN JUAL
  Q  Penawaran
  S  Sales Order
  F  Proforma Invoice
  D  Delivery
  I  Invoice

DOKUMEN BELI
  P  Purchase Order
  F  Proforma Invoice
  D  Delivery
  I  Invoice

MASTER DATA
  ...
```

Deal Tracker nav link does NOT call `$store.doc.setType()` — it is not a document type. Instead it sets `$store.shell.activeView = 'deal-tracker'` and loads the deal-tracker partial directly into `#doc-body`.

## View Routing

Deal Tracker is a dashboard, not a document module. When clicked:
1. `shellStore.setActive('deal-tracker', 'jual')` — sets activeView
2. The Opsi panel + scroller are hidden (no document is active)
3. `#doc-body` loads `partials/deal-tracker.html` via htmx
4. deal-tracker.html reads from `$store.deal.deals` (reactive getter)

No `$store.doc.setType` call. No document scroller. No Opsi panel.

## Seed Data

Current seed: `doc_so_0001` has `status: 'draft'`. Need to change to `status: 'sent'` so Deal Tracker has at least one deal to show. Also ensure `doc_0001` (Quotation) remains `status: 'sent'` so the SO can link back.

## Edge Cases

- **No deals**: Show empty state with icon + text "Belum ada deal. Simpan Sales Order untuk memulai tracking."
- **SO with no pricing on lines**: HPP = 0, Margin = Nilai Deal (100%). Show HPP as "—" or "Rp 0".
- **Multiple PFI/Delivery/Invoice for same deal**: Show the latest (most recent `saved_at` or `date`).
- **Chain Beli docs don't exist yet**: All 4 steps show empty circles. Normal state for new deals.