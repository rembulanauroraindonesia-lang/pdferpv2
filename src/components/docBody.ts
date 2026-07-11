/**
 * docBody(docId) — hydrate a document body (Alpine x-data factory).
 * Lives on the wrapper div around the <article class="page"> elements.
 *
 * Loads the doc + related data and exposes reactive lines + totals +
 * the draft→master field pattern + multi-page pagination.
 *
 * PRINCIPLE: getters read `this.X` (Alpine reactive proxy), NOT the
 * closed-over `state` ref. The old main.ts version mixed both and caused
 * the recurring reactivity bugs (pitfall #1/#9). This file uses `this.`
 * throughout so Alpine tracks every read.
 */
import type { DocumentLine } from "@/types/schema";
import type { AlpineComponent } from "@/types/alpine";
import { documentById } from "@/data/documents";
import { companyById } from "@/data/companies";
import { partyById } from "@/data/parties";
import { signatoryById } from "@/data/signatories";
import { termsByDocument, terms } from "@/data/terms";
import { linesByDocument, documentLines } from "@/data/documentLines";
import { calcTotals, type DocTotals } from "@/lib/calc";
import { formatNumber, formatMoney, formatDateID } from "@/lib/format";

/** Live-computed total for a line. Reads from the underlying object so
 *  mutations to qty/unit_price anywhere (UI or pricing modal) reflect here. */
export function lineTotal(l: Pick<DocumentLine, "qty" | "unit_price">): number {
  return l.qty * l.unit_price;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export type DocBodyComponent = Partial<AlpineComponent> & {
  doc: ReturnType<typeof documentById>;
  company: ReturnType<typeof companyById>;
  companyDraft: ReturnType<typeof companyById> | undefined;
  party: ReturnType<typeof partyById>;
  signatory: ReturnType<typeof signatoryById>;
  termsList: ReturnType<typeof termsByDocument>;
  lines: DocumentLine[];
  editing: Record<string, boolean>;
  priceEditing: Record<string, boolean>;
  deliveryTerm: "Franco" | "Locco";
  deliveryOpen: boolean;
  termDrafts: Record<string, string>;
  termEditing: Record<string, boolean>;
  readonly canAddTerm: boolean;
  LINES_PER_PAGE: number;
  lineCount: number;
  readonly subtotal: number;
  readonly totals: DocTotals;
  readonly pagedLines: DocumentLine[][];
  readonly pageCount: number;
  fmt(n: number): string;
  money(n: number): string;
  fmtDate(iso: string): string;
  fmtStamp(iso: string): string;
  displayPrice(line: DocumentLine): number;
  displayTotal(line: DocumentLine): number;
  startEdit(field: string): void;
  commitDefault(field: string): void;
  cancelEdit(field: string): void;
  startTermEdit(id: string): void;
  commitTermDefault(id: string): void;
  cancelTermEdit(id: string): void;
  addTerm(): void;
  removeTerm(id: string): void;
  addLine(idx: number): void;
  removeLine(idx: number): void;
  renumber(): void;
  setDate(iso: string): void;
  setParty(partyId: string): void;
  setDelivery(term: "Franco" | "Locco"): void;
  openPricing(line: unknown): void;
};
export function docBody(docId: string): DocBodyComponent {
  const doc = documentById(docId);
  const company = doc ? companyById(doc.company_id) : undefined;
  const party = doc?.party_id ? partyById(doc.party_id) : undefined;
  // PFI BELI: auto-load supplier bank from party on init.
  // setParty() covers the case when user changes supplier via picker;
  // this handles the initial mount where party is already set in the seed.
  if (doc && party && doc.type === "proforma_invoice" && doc.direction === "beli") {
    doc.supplier_bank_name = party.bank_name || "";
    doc.supplier_bank_account = party.bank_account || "";
    doc.supplier_bank_account_name = party.bank_account_name || "";
  }
  const signatory = doc?.signatory_id ? signatoryById(doc.signatory_id) : undefined;
  const termsList = doc ? termsByDocument(doc.id) : [];
  const rawLines = doc ? linesByDocument(doc.id) : [];
  const companyDraft = company ? { ...company } : undefined;

  return {
    doc,
    company,
    companyDraft,
    party,
    signatory,
    termsList,
    // Use the SAME object references as the global documentLines store.
    // Alpine's deep reactivity wraps the lines array, so UI mutations to
    // line.qty / line.unit_price / line.pricing propagate to the underlying
    // DocumentLine — which the docStore getters read via linesByDocument().
    // (Previously we did rawLines.map(makeReactiveLine) which created
    // shallow copies; mutations stayed local and PPN/totals went stale.)
    lines: rawLines,
    editing: { address: false, phone: false, email: false, subject: false, salutation: false },
    priceEditing: {} as Record<string, boolean>,
    deliveryTerm: (doc?.shipping_terms as "Franco" | "Locco") || "Franco",
    deliveryOpen: false,
    termDrafts: {} as Record<string, string>,
    termEditing: {} as Record<string, boolean>,
    LINES_PER_PAGE: 12,
    lineCount: rawLines.length,

    get subtotal(): number {
      return this.lines.reduce((s, l) => s + lineTotal(l), 0);
    },
    get totals(): DocTotals {
      const base = calcTotals(this.lines, 0.11, this.$store!.doc.ppnIncluded);
      return { ...base, grandTotal: base.grandTotal + this.$store!.doc.shippingCost };
    },
    get pagedLines(): DocumentLine[][] {
      void this.lineCount;
      const per = this.LINES_PER_PAGE;
      const chunks: DocumentLine[][] = [];
      for (let i = 0; i < this.lines.length; i += per) {
        chunks.push(this.lines.slice(i, i + per));
      }
      return chunks.length ? chunks : [[]];
    },
    get pageCount(): number {
      return this.pagedLines.length;
    },
    get canAddTerm(): boolean {
      return this.termsList.length < 6;
    },

    fmt(n: number): string { return formatNumber(n); },
    money(n: number): string { return formatMoney(n); },
    fmtDate(iso: string): string { return formatDateID(iso); },
    fmtStamp(iso: string): string {
      const d = new Date(iso);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
    },
    // Per-line display price: include or exclude based on PPN mode.
    // The stored line.unit_price is always the INCLUDE (final sell)
    // price; the mode just changes how it appears in the table.
    displayPrice(line: DocumentLine): number {
      return this.$store!.doc.ppnIncluded
        ? line.unit_price
        : line.unit_price / 1.11;
    },
    displayTotal(line: DocumentLine): number {
      return this.displayPrice(line) * line.qty;
    },

    // ── Field edit pattern (draft → master) ─────────────────────
    startEdit(field: string) {
      this.editing[field] = true;
    },
    commitDefault(field: string) {
      const master = this.company as unknown as Record<string, unknown> | null;
      const draft = this.companyDraft as unknown as Record<string, unknown> | null;
      if (master && draft && field in master) master[field] = draft[field];
      this.editing[field] = false;
    },
    cancelEdit(field: string) {
      const master = this.company as unknown as Record<string, unknown> | null;
      const draft = this.companyDraft as unknown as Record<string, unknown> | null;
      if (master && draft && field in master) {
        draft[field] = master[field];
      }
      this.editing[field] = false;
    },

    // ── Line item mutations ─────────────────────────────────────
    addLine(idx: number) {
      if (!this.doc) return;
      const newLine: DocumentLine = {
        id: "dl_new_" + Date.now(),
        document_id: this.doc.id,
        line_no: 0,
        item_name: "",
        qty: 0,
        unit: "Pcs",
        unit_price: 0,
      };
      this.lines.splice(idx, 0, newLine);
      documentLines.push(newLine);
      this.lineCount = this.lines.length;
      this.renumber();
      this.$store?.doc.touch();
    },
    removeLine(idx: number) {
      if (!this.doc) return;
      const removed = this.lines.splice(idx, 1)[0];
      const storeIdx = documentLines.findIndex((l) => l.id === removed.id);
      if (storeIdx >= 0) documentLines.splice(storeIdx, 1);
      this.lineCount = this.lines.length;
      this.renumber();
      this.$store?.doc.touch();
    },
    renumber() {
      this.lines.forEach((l, i) => { l.line_no = i + 1; });
    },

    // ── Term edits (draft → master pattern, like company fields) ──
    startTermEdit(id: string) {
      const term = this.termsList.find((t) => t.id === id);
      if (term) this.termDrafts[id] = term.body;
      this.termEditing[id] = true;
    },
    commitTermDefault(id: string) {
      const term = this.termsList.find((t) => t.id === id);
      if (term && this.termDrafts[id] !== undefined) term.body = this.termDrafts[id];
      this.termEditing[id] = false;
    },
    cancelTermEdit(id: string) {
      const term = this.termsList.find((t) => t.id === id);
      if (term) this.termDrafts[id] = term.body;
      this.termEditing[id] = false;
    },
    addTerm() {
      if (!this.doc || this.termsList.length >= 6) return;
      const newSeq = this.termsList.length + 1;
      const newTerm = {
        id: `tm_${this.doc.id.slice(-3)}_new_${Date.now()}`,
        document_id: this.doc.id,
        seq: newSeq,
        body: "Syarat baru...",
      };
      this.termsList.push(newTerm);
      terms.push(newTerm);
    },
    removeTerm(id: string) {
      if (!this.doc) return;
      const idx = this.termsList.findIndex((t) => t.id === id);
      if (idx < 0) return;
      this.termsList.splice(idx, 1);
      const srcIdx = terms.findIndex((t) => t.id === id);
      if (srcIdx >= 0) terms.splice(srcIdx, 1);
      this.termsList.forEach((t, i) => { t.seq = i + 1; });
      terms.filter((t) => t.document_id === this.doc!.id).forEach((t, i) => { t.seq = i + 1; });
      delete this.termDrafts[id];
      delete this.termEditing[id];
    },

    setDate(iso: string) {
      if (this.doc) this.doc.date = iso;
    },
    setParty(partyId: string) {
      if (!this.doc) return;
      this.doc.party_id = partyId;
      const p = partyById(partyId);
      if (p) {
        this.party = p;
        // PFI BELI: auto-load supplier bank account
        if (this.doc.type === "proforma_invoice" && this.doc.direction === "beli") {
          this.doc.supplier_bank_name = p.bank_name || "";
          this.doc.supplier_bank_account = p.bank_account || "";
          this.doc.supplier_bank_account_name = p.bank_account_name || "";
        }
      }
    },
    setDelivery(term: "Franco" | "Locco") {
      this.deliveryTerm = term;
      this.deliveryOpen = false;
      // Sync to document so linkQuotation/linkSalesOrder can read it
      if (this.doc) {
        this.doc.shipping_terms = term;
        if (term === "Locco") this.doc.shipping_address = ""; // Locco = barang dijemput, alamat kirim tidak relevan
      }
    },
    // Open the pricing calculator for a given line. Finds the calc element
    // (sibling x-data) and calls its show() with the line context.
    openPricing(line: unknown) {
      const root = this.$el?.closest("[x-data^='docBody']") as HTMLElement | null;
      const calcEl = root?.querySelector("[x-data^='pricingCalculator']") as (HTMLElement & { _x_dataStack?: any[] }) | null;
      const calcData = calcEl?._x_dataStack?.[0];
      if (calcData && typeof calcData.show === "function") calcData.show(line);
    },
  };
}
