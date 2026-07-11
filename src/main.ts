/**
 * main.ts — app wiring only.
 * ----------------------------------------------------------------------------
 * Imports CSS, initializes Alpine + htmx, registers the two stores and the
 * four x-data component factories. All component logic lives in src/components/
 * and src/state/ — this file just stitches them together.
 *
 * Layout:
 *   src/state/      — Alpine stores ($store.doc, $store.shell)
 *   src/components/ — Alpine x-data factories (documentView, docBody,
 *                     datePicker, partyPicker)
 *   src/lib/        — pure functions (calc, format, docNo, locale)
 *   src/data/       — placeholder data mirroring future PocketBase collections
 *   src/types/      — schema + Alpine shared types
 */
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/document.css";
import "./styles/dashboard.css";

import Alpine from "alpinejs";
import htmx from "htmx.org";

import { docStore, type DocStore } from "@/state/docStore";
import { dealStore } from "@/state/dealStore";
import { paymentStore } from "@/state/paymentStore";
import { shellStore } from "@/state/shellStore";
import { makeDocumentView } from "@/components/documentView";
import { docBody } from "@/components/docBody";
import { datePicker } from "@/components/datePicker";
import { partyPicker } from "@/components/partyPicker";
import { pricingCalculator } from "@/components/pricingCalculator";
import { fileUpload } from "@/components/fileUpload";
import { paymentMethod } from "@/components/paymentMethod";
import { uploadLibrary } from "@/components/uploadLibrary";

import { documentById } from "@/data/documents";
import { documents, documentsByType, documentById as getDoc } from "@/data/documents";
import { linesByDocument } from "@/data/documentLines";
import { partyById } from "@/data/parties";
import { partiesStore } from "@/state/partiesStore";
import { signatureStore } from "@/state/signatureStore";
import { itemsStore } from "@/state/itemsStore";
import { companyById } from "@/data/companies";
import { signatoryById } from "@/data/signatories";
import { termsByDocument } from "@/data/terms";
import { staff } from "@/data/staff";
import { calcTotals } from "@/lib/calc";
import { formatNumber, formatRupiah, formatMoney, formatDateID, statusMeta, parseMoneyInput } from "@/lib/format";
import { initRouter, updateHash } from "@/lib/router";
import { initDB } from "@/lib/db";
import { seedIfNeeded } from "@/lib/seed";
import { loadFromDB } from "@/lib/persist";

declare global {
  interface Window {
    htmx: typeof htmx;
    Alpine: typeof Alpine;
  documentView: ReturnType<typeof makeDocumentView>;
  docBody: typeof docBody;
  datePicker: typeof datePicker;
  partyPicker: typeof partyPicker;
  pricingCalculator: typeof pricingCalculator;
  fileUpload: typeof fileUpload;
  paymentMethod: typeof paymentMethod;
  uploadLibrary: typeof uploadLibrary;
  ERP: typeof ERP;
  }
}

// htmx must be on window for hx-* attributes to work
window.htmx = htmx;
htmx.config.selfRequestsOnly = true;

// ── Data access exposed to any non-Alpine code that needs it ──────
const ERP = {
  formatNumber, formatRupiah, formatDateID, statusMeta, calcTotals,
  documents, documentsByType, documentById: getDoc,
  linesByDocument, partyById, companyById, signatoryById, termsByDocument,
  staff,
  updateHash,
};
window.ERP = ERP;

// ── Register Alpine stores ───────────────────────────────────────
Alpine.store("doc", docStore());
Alpine.store("shell", shellStore());
Alpine.store("deal", dealStore());
Alpine.store("payment", paymentStore());
Alpine.store("parties", partiesStore());
Alpine.store("signatures", signatureStore());
Alpine.store("items", itemsStore());

// ── Register Alpine x-data factories (globals for partials) ──────
window.documentView = makeDocumentView(Alpine);
window.docBody = docBody;
window.datePicker = datePicker;
window.partyPicker = partyPicker;
window.pricingCalculator = pricingCalculator;
window.fileUpload = fileUpload;
window.paymentMethod = paymentMethod;
window.uploadLibrary = uploadLibrary;

// ── x-money directive: ERP accounting format on nominal inputs ─────
// Usage: <input x-money="line.unit_price" />
// - Placeholder "0" shows when empty (guide only)
// - On blur: formats the typed number with separators (29450000 → 29.450.000,00)
// - On focus: shows raw number for editing
// - Stores the numeric value to the bound expression
// This is the BAKU rule for all ERP nominal inputs.
//
// Implementation: x-money reads/writes the bound model via Alpine's magics.
// We expose $moneyFmt(n) and $moneyParse(s) as Alpine magics so the partial
// can do: <input x-model.number="val" @blur="$el.value = $moneyFmt(val)"
//                                                      @focus="$el.value = $moneyParse($el.value)">
// Simpler and scope-safe than a directive fighting x-model.

Alpine.magic("moneyFmt", () => (n: number) => (n === 0 ? "" : formatMoney(n)));
Alpine.magic("moneyParse", () => (s: string) => parseMoneyInput(s));
Alpine.magic("intFmt", () => (n: number) => (n === 0 ? "" : Math.round(n).toLocaleString("id-ID")));
Alpine.magic("intParse", () => (s: string) => {
  if (!s || s.trim() === "") return 0;
  return Number(s.replace(/\./g, "")) || 0;
});
Alpine.magic("numFmt", () => (n: number) => (n === 0 ? "0" : Math.round(n).toLocaleString("id-ID")));

Alpine.start();

// ── htmx + Alpine integration ──────────────────────────────────
// Every time htmx swaps content into #doc-body, Alpine needs to
// discover and initialize any x-data / x-show / x-for directives
// in the new HTML. Without this, special-route partials (deal-tracker,
// parties, upload) and document partials all render as dead HTML.
htmx.on("htmx:afterSettle", (evt: any) => {
  const target = evt?.detail?.target as HTMLElement | undefined;
  if (target) Alpine.initTree(target);
});

// Sync the doc store with the initial document's state (status, revisions)
(() => {
  const store = Alpine.store("doc") as unknown as DocStore;
  const initial = documentById(store.currentId);
  if (initial) store.syncFromDoc(initial);
})();

// Initial body load is handled by x-effect="loadBody()" on .document-view.

// ── Hash-based routing ────────────────────────────────────────
initRouter();

// ── PocketBase initialization (non-blocking, graceful degradation) ─
(async () => {
  const connected = await initDB();
  if (connected) {
    await seedIfNeeded();
    await loadFromDB();
    // Re-sync the doc store with freshly loaded data
    const store = Alpine.store("doc") as unknown as DocStore;
    const current = documentById(store.currentId);
    if (current) store.syncFromDoc(current);
  }
})();
