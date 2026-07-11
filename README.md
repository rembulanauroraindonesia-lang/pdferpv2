# PDFERPV2 — Document-centric ERP (mockup)

A working mockup where **business documents are living objects**: the quotation,
invoice, PO, and payment are not forms that *feed* a database — they *are* the
database, rendered as the document itself. You read it like a letter; you edit
it in place; the numbers recompute live.

This first iteration reproduces the source PDF
(`Penawaran Harga - PT Gandasari rev2.pdf`) as an editable document, with every
component mapped to a future PocketBase collection.

---

## Stack

| Layer | Choice | Role |
|---|---|---|
| Build | **Vite + TypeScript** | dev server, type safety |
| Hypermedia | **htmx** | load document views as HTML partials (`hx-get` → swap) |
| Reactivity | **Alpine.js** | intra-document live recompute (qty×price, totals) |
| DB | **PocketBase** *(deferred)* | SQLite + REST + auth + admin + files |
| BFF | **Hono** *(deferred)* | renders htmx fragments from PocketBase JSON |

> **Why Alpine alongside htmx?** htmx's model is request → HTML fragment.
> But recomputing `qty × price` on every keystroke should not round-trip the
> server. Alpine is htmx's official companion for exactly this: reactive DOM
> for state that lives only in the browser. htmx handles *navigation* (which
> document), Alpine handles *interaction* (editing the current one).

---

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

---

## Folder structure

```
index.html                       # App shell: sidebar + topbar + <main>
public/partials/
  quotation.html                 # ⭐ the living document (built)
  invoice.html  po.html  payment.html   # stubs (annotated for next phase)
src/
  main.ts                        # Alpine + htmx init; exposes ERP.* helpers
  types/schema.ts                # ⭐ TS interfaces = future PocketBase collections
  data/                          # placeholder data, mirrors DB shape
    companies.ts  parties.ts  items.ts  documents.ts
    documentLines.ts  terms.ts  signatories.ts  bankAccounts.ts
    index.ts                     #   single import surface = data access layer
  lib/
    calc.ts                      # pure: lineTotal, subtotal, calcTotals
    format.ts                    # pure: formatRupiah, formatDateID, statusMeta
  styles/
    tokens.css  base.css  shell.css  document.css
```

---

## Schema map — every PDF component → a collection

This is the core idea of the project. Each visual block in the document is one
entity. Derived values (totals) are never stored.

| Component on the PDF | Collection | Key fields | Notes |
|---|---|---|---|
| PT Rembulan Aurora (issuer) | `companies` | name, address, phone, npwp | "our" company |
| Tgl / No / Perihal | `documents` | doc_no, type, date, subject, status | one record per document |
| PT Gandasari + "Up: Ibu Tiara" | `parties` | name, contact_person | customer/supplier |
| Plat Kapal 12mm line | `document_lines` | item_name, qty, unit, unit_price | total is derived |
| Subtotal / PPN / Total | *(derived)* | — | computed in `calc.ts`, not stored |
| Terms & Conditions | `terms` | seq, body | one row per clause |
| Winarto, Direktur | `signatories` | name, role, signature_image | |
| BNI 8900011182 | `bank_accounts` | bank, account_no, account_name | referenced from terms |
| Master barang | `items` | code, name, category, unit | price lives on lines, not here |

### Relationships

```
companies 1───∗ bank_accounts
companies 1───∗ documents (issuer)
parties   1───∗ documents (recipient)
documents 1───∗ document_lines
documents 1───∗ terms
documents 1───1 signatories
items     1───∗ document_lines (optional — line can be ad-hoc)
```

Open the **DB Map** toggle in the topbar to see each region of the document
annotated with its collection name in amber.

---

## Interaction model (what happens when)

| Action | Mechanism | Why |
|---|---|---|
| Click sidebar nav | htmx `hx-get /partials/X.html` → swap `#workspace` | loads a document view as HTML |
| Edit company name / terms / etc | `contenteditable` `.field` | free-text, no recompute needed |
| Type in qty / unit price | Alpine `x-model.number` → `x-effect` recompute | live, no server round-trip |
| Line total / Subtotal / PPN / Total | Alpine getters calling `calc.ts` | derived from lines |
| Toggle "DB Map" | Alpine `$store.shell.toggleMap()` → `body.map-on` | pure CSS reveal of data tags |

### htmx vs Alpine — the rule

- **htmx** = moving between documents / persisting a save (a request leaves the browser)
- **Alpine** = anything that should feel instant *within* the current view

When the BFF lands, the boundary stays the same. The partial that today is a
static file at `/partials/quotation.html` becomes a Hono route that renders the
same HTML from PocketBase data — the frontend code does not change.

---

## Migration path (mockup → real)

Today's mockup is **forward-compatible** by design:

1. **Data layer** — `src/data/*.ts` are placeholders. Each exports accessor
   functions (`documentById`, `linesByDocument`, …). Replace their bodies with
   PocketBase SDK calls; signatures stay the same. UI keeps working.

   ```ts
   // before
   export const documentById = (id) => documents.find(d => d.id === id);
   // after (future)
   export const documentById = (id) => pb.collection('documents').getOne(id);
   ```

2. **Partial rendering** — move `public/partials/quotation.html` into a Hono
   route. It renders the same template server-side from PocketBase records.
   htmx URLs in the shell already point at `/partials/...`; remap them to
   Hono routes (e.g. `/documents/:id/view`) in one pass.

3. **Alpine bindings unchanged** — `x-model` on inputs, getters on totals.
   Whether the initial values come from `ERP.seedLines()` (now) or from the
   server-rendered HTML (later) is invisible to the template.

4. **PocketBase schema** — `src/types/schema.ts` is the blueprint. Create one
   collection per interface, set field types, add relations as listed above.

---

## What's deliberately deferred

- ❌ PocketBase not installed / no DB running
- ❌ No Hono BFF — partials served as static files by Vite
- ❌ No auth / login
- ❌ No persistence — edits live only in browser memory
- ✅ All data structures are real and ready to port

---

## Source of truth

The seed data in `src/data/*` mirrors
`/Users/jeremy/Documents/PO/16-GANDASARI/Penawaran Harga - PT Gandasari rev2.pdf`
exactly: PT Rembulan Aurora issuing a quotation to PT Gandasari for 100 pcs of
Plat Kapal 12mm × 8' × 30' Non Class at Rp 29.450.000/pc (nett, PPN 11% included),
grand total Rp 2.945.000.000.
