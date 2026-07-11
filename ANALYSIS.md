# PDFERPV2 — Project Analysis

## What it is

A **document-centric ERP mockup** where business documents (quotations, invoices, POs, payments) are the primary interface — not forms feeding a database, but the document *itself* rendered as an editable artifact. You read it like a letter, edit in place, and numbers recompute live.

## Stack

| Layer | Choice | Status |
|---|---|---|
| Build | Vite 8 + TypeScript 6 | ✅ Working |
| Hypermedia | htmx 2 | ✅ Active — loads partials via `hx-get` |
| Reactivity | Alpine.js 3 | ✅ Active — all intra-doc interaction |
| DB | PocketBase | ❌ Deferred — placeholder data in TS files |
| BFF | Hono | ❌ Deferred — partials served as static files |

## Codebase metrics

- **3,555 lines total** across 27 source files
- **1,679 lines CSS** (tokens + base + shell + document) — hand-rolled, no Tailwind
- **TypeScript: clean** — `tsc --noEmit` passes, zero errors
- **Build: clean** — 135KB JS (gzip 41KB), 31KB CSS (gzip 7KB)
- **No tests** — no test framework installed

## Architecture

```
types/schema.ts    →  9 interfaces = future PocketBase collections
data/*.ts          →  placeholder accessors (swap bodies → PocketBase SDK, signatures unchanged)
lib/*.ts           →  pure functions (calc, pricing, format, docNo, locale)
state/*.ts         →  Alpine stores ($store.doc, $store.shell)
components/*.ts    →  Alpine x-data factories (docBody, documentView, datePicker, partyPicker, pricingCalculator)
main.ts            →  wiring only (imports CSS, registers stores, starts Alpine)
public/partials/   →  HTML fragments loaded by htmx (quotation.html = 480 lines, built; invoice/po/payment = stubs)
```

The migration path is well-designed: replace `data/*.ts` function bodies with PocketBase SDK calls, move partials to Hono routes, and the frontend doesn't change.

## What's built

| Feature | Status | Quality |
|---|---|---|
| Quotation document | ✅ Fully built | 480-line partial with letterhead, meta, party picker, line items, terms, signatory, bank info |
| Live line totals (qty × price) | ✅ | Alpine getters, no server round-trip |
| PPN calculation (included/excluded) | ✅ | `calc.ts` handles both modes, backing out PPN from nett |
| Document numbering | ✅ | `QTN/RAI/26/0001` format with auto-increment + revision suffix (r1, r2, r3) |
| Draft → Simpan → Revisi lifecycle | ✅ | State machine with max 3 revisions, lock/unlock, batal revisi |
| Multi-page pagination | ✅ | 12 lines/page, continuation pages repeat letterhead |
| Stack/side layout toggle | ✅ | CSS-driven via `data-layout` attribute |
| DB Map X-ray overlay | ✅ | Toggle shows amber collection-name annotations on each document region |
| Contenteditable fields with draft→master pattern | ✅ | "Jadikan default" pill commits edits to master company record |
| Inline date picker | ✅ | Indonesian locale, local time (avoids UTC off-by-one) |
| Party picker with quick-add | ✅ | Searchable dropdown + inline create new party |
| Pricing calculator modal | ✅ | Bidirectional per-kg ↔ per-unit via weight, buy/sell margin, supplier link |
| Money formatting | ✅ | Indonesian format (29.450.000,00), `$moneyFmt`/`$moneyParse` Alpine magics |
| Doc scroller (chip carousel) | ✅ | Horizontal scroll with blur edges, +Baru button, revision badges |
| Invoice / PO / Payment partials | ❌ Stubs | 16-18 line placeholder HTML each |
| Master data management (perusahaan, pihak, item) | ❌ | Sidebar links exist but no views |
| Persistence | ❌ | All edits live in browser memory only |
| Auth | ❌ | Not implemented |
| Print/Download | ⚠️ Stub | Both just call `window.print()` |

## Strengths

1. **Schema-first design.** `types/schema.ts` is a complete blueprint — 9 interfaces with relations, comments mapping each field to its PDF component, and notes on what's derived vs stored. This is production-ready documentation that doubles as a PocketBase schema spec.

2. **Pure function discipline.** `calc.ts`, `pricing.ts`, `format.ts`, `docNo.ts` are all pure — no side effects, no DOM access, testable in isolation. The pricing module's bidirectional derivation (per-kg ↔ per-unit via weight) is well-reasoned with edge case handling (weight=0 → no derivation).

3. **Forward-compatible architecture.** The data access layer (`data/index.ts`) exports accessor functions with stable signatures. Replacing mock data with PocketBase calls is a body-swap, not a refactor. The htmx partial URLs (`/partials/quotation.html`) map 1:1 to future Hono routes (`/documents/:id/view`).

4. **Document lifecycle is well-modeled.** Draft → Simpan (lock) → Revisi (max 3×) → Batal. Revision count lives on the document, the base `doc_no` never changes, and the UI reflects state accurately (disabled buttons, status badges, revision labels).

5. **Design system is intentional.** Industrial slate palette (cool neutrals, deep steel blue accent, amber for DB-map overlay). Serif typography for the document body (Georgia) vs sans for the shell — the document reads as an official letter, the tool recedes. Token-based, no magic numbers in document.css.

6. **Alpine reactivity is correctly implemented.** The docBody component uses `this.` throughout (not closed-over refs) to ensure Alpine tracks all reactive reads. The `makeReactiveLine` pattern with `Object.defineProperty` for computed `total` is clean.

## Weaknesses & gaps

1. **Only quotation is built.** Invoice, PO, and payment are 16-18 line stubs. The architecture supports them, but the partials don't exist. This is the biggest functional gap.

2. **No persistence layer.** Everything is in-memory. A page refresh loses all edits. The README acknowledges this — PocketBase is "deliberately deferred" — but it means the mockup can't be used for real work.

3. **No tests.** The pure functions in `lib/` are begging for unit tests. `calcTotals` with included vs excluded PPN, `derivePricing` bidirectional logic, `nextDocNo` sequence generation, `parseMoneyInput` edge cases — all are trivially testable but have zero coverage.

4. **Direct DOM manipulation in Alpine components.** `docBody.setParty()` and `cancelEdit()` use `document.querySelector` to update DOM text — this fights Alpine's reactive model. The party name/address/contact should be reactive bindings, not imperative DOM writes.

5. **`pricingCalculator.apply()` reaches into Alpine internals.** It accesses `_x_dataStack` to find the parent docBody's line array. This is fragile — it depends on Alpine's internal data structure and the DOM nesting order. A cleaner approach would be dispatching an event that docBody handles.

6. **No dark mode.** The token system uses CSS custom properties, so dark mode would be straightforward to add, but it's not there.

7. **No routing.** The app is a single page with Alpine store controlling which partial loads. There's no URL state — you can't bookmark or share a link to a specific document. Browser back button does nothing.

8. **Print CSS is incomplete.** `window.print()` is called but there's no `@media print` rules to hide the shell (sidebar, topbar, scroller) and show only the document. The printed output would include the entire app chrome.

## Recommendations (priority order)

1. **Build the invoice partial.** Same structure as quotation — reuse 80% of quotation.html.
2. **Add unit tests for `lib/`.** Vitest + the pure functions. 30 minutes, enormous confidence payoff.
3. **Fix the DOM manipulation in docBody.** Replace `document.querySelector` calls with reactive Alpine bindings.
4. **Add `@media print` rules.** Hide shell, show only `.page` elements.
5. **Add PocketBase.** Schema is ready, data layer is ready, partials are ready.

## Verdict

A well-architected mockup with a clear, original idea — documents as the database, not reports from it. The code quality is above average: pure functions where it matters, clean layer separation, forward-compatible data access, and a thoughtful design system. The main risk is that it stays a mockup forever — the distance from "working frontend" to "real tool" is PocketBase + Hono + 3 more partials. The foundation is solid enough to build on.
