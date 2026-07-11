/**
 * $store.doc — active document instance + layout mode + state machine.
 * Registered via Alpine.store("doc", docStore()) in main.ts.
 *
 * State machine:
 *   draft ──Simpan──▶ saved (locked, tak bisa edit)
 *     ▲                 │
 *     └────Revisi────────┘  (maks 3×, last revision = source of truth)
 *
 * Mockup in-memory. When PocketBase lands: save/revise/addNew become
 * PATCH/POST calls; setCurrent loads from DB; everything else stays.
 */
import htmx from "htmx.org";
import type { Document, DocumentType, DocumentStatus, PageLayout, DocDirection } from "@/types/schema";
import { MAX_REVISIONS } from "@/types/schema";
import { documents, documentsByType, documentById } from "@/data/documents";
import { linesByDocument, documentLines } from "@/data/documentLines";
import type { DocumentLine } from "@/types/schema";
import { partyById } from "@/data/parties";
import { staffById } from "@/data/staff";
import { nextDocNo } from "@/lib/docNo";
import { updateHash } from "@/lib/router";
import { saveCurrentDoc } from "@/lib/persist";

// Subject + salutation per document type. Used by addNew() and shown on
// each doc's header. Direction-aware: BELI flows are addressed to the
// supplier; JUAL flows to the customer.
const TYPE_SUBJECT: Record<DocumentType, string> = {
  quotation: "Penawaran Harga",
  sales_order: "Sales Order",
  proforma_invoice: "Proforma Invoice",
  delivery: "Surat Jalan",
  pickup: "Pickup Memo",
  invoice: "Invoice",
  po: "Purchase Order",
  payment: "Bukti Pembayaran",
};

const TYPE_SALUTATION: Record<DocumentType, string> = {
  quotation:
    "Dengan Hormat,\nKami ingin memberikan penawaran terbaik kami untuk material:",
  sales_order:
    "Dengan Hormat,\nBerdasarkan persetujuan atas penawaran kami, berikut adalah Sales Order:",
  proforma_invoice:
    "Dengan Hormat,\nBerikut Proforma Invoice untuk material:",
  delivery:
    "Dengan Hormat,\nBarang-barang tersebut di bawah ini telah kami kirim:",
  pickup:
    "Dengan Hormat,\nBerikut pickup memo untuk material yang telah siap diambil:",
  invoice:
    "Dengan Hormat,\nBerikut invoice untuk material yang telah dikirim:",
  po:
    "Dengan Hormat,\nKami memesan material berikut dari Bapak/Ibu:",
  payment:
    "Dengan Hormat,\nBerikut bukti pembayaran untuk invoice:",
};

export interface DocStore {
  currentId: string;
  pageLayout: PageLayout;
  type: DocumentType;
  direction: DocDirection;
  optionsVisible: boolean;
  docsVersion: number;
  lastNewId: string;
  status: DocumentStatus;
  revisionCount: number;
  savedAt: string | undefined;
  isRevising: boolean;
  ppnIncluded: boolean;
  marketingStaffId: string;
  shippingMode: "free" | "bebankan";  // free=seller absorbs, bebankan=customer pays
  shippingCost: number;          // Ongkos Kirim (Customer) — used when mode=bebankan
  shippingCostInclude: number;   // Ongkos Kirim (Include) — used when mode=free
  komisi: number;
  readonly currentDoc: Document | undefined;
  readonly canRevise: boolean;
  readonly isLocked: boolean;
  readonly isEditable: boolean;
  readonly canCancel: boolean;
  readonly totalSell: number;
  readonly totalBuy: number;
  readonly totalMargin: number;
  readonly totalMarginPct: number;
  readonly komisiPct: number;
  readonly marketingStaffName: string;
  readonly docTitle: string;
  readonly docTitleSub: string;
  // PPN potential (auto-calculated; PPN = include × 11/111)
  readonly ppnKeluaran: number;   // PPN on totalSell (output VAT)
  readonly ppnMasukan: number;    // PPN extracted from per-line buy_per_unit (input VAT)
  readonly potensiPajak: number;  // ppnKeluaran − ppnMasukan
  setCurrent(id: string): void;
  setLayout(layout: PageLayout): void;
  setType(type: DocumentType, direction: DocDirection): void;
  syncFromDoc(doc: Document): void;
  save(): void;
  revise(): void;
  cancelRevise(): void;
  print(): void;
  download(): void;
  addNew(): void;
  readonly hasEmptyNew: boolean;
  isNewEmpty(docId: string): boolean;
  setPpnIncluded(value: boolean): void;
  setMarketingStaff(id: string): void;
  setShippingMode(value: "free" | "bebankan"): void;
  setShippingCost(value: number): void;
  setShippingCostInclude(value: number): void;
  setKomisi(value: number): void;
  // Hubungkan Dokumen (SO only, accessed from Opsi panel)
  linkQuotationId: string;
  editingLink: Record<string, boolean>;
  readonly linkQuotationOptions: { id: string; doc_no: string; party_name: string }[];
  linkDoc(): Document | undefined;
  linkQuotation(quotationId: string): void;
  updateLinkField(field: string, value: string): void;
  touch(): void;
  _linkCreditDays: number;
  _linkQuotationDocNo: string;
  readonly linkJatuhTempo: string;
  readonly linkQuotationRef: string;
  // Hubungkan Dokumen — PFI loads from Sales Order
  linkSalesOrderId: string;
  readonly linkSalesOrderOptions: { id: string; doc_no: string; party_name: string }[];
  linkSalesOrder(soId: string): void;
  _linkSoDocNo: string;
  readonly linkSoRef: string;
  readonly linkPaymentTerms: string;
  _linkPaymentTerms: string;
  // Hubungkan Dokumen — PO loads from Sales Order
  linkPODocId: string;
  readonly linkPurchaseOrderOptions: { id: string; doc_no: string; party_name: string }[];
  readonly linkPOSuppliers: { id: string; name: string; lineCount: number }[];
  selectedPOSupplierIds: string[];
  startPOCreation(soId: string): void;
  createPOFromSO(): void;
  _linkPOFromDocNo: string;
  readonly linkPOFrom: string;
  readonly poPaymentTerms: string;
  // Hubungkan Dokumen — PFI BELI loads from Purchase Order
  linkPFIBeliPOId: string;
  readonly linkPFIBeliPOOptions: { id: string; doc_no: string; party_name: string }[];
  linkPFIBeliPO(poId: string): void;
  _linkPFIBeliRef: string;
  readonly linkPFIBeliFrom: string;
  // Hubungkan Dokumen — Delivery loads from Sales Order
  linkDeliverySOId: string;
  readonly linkDeliverySOOptions: { id: string; doc_no: string; party_name: string }[];
  linkDeliveryFromSO(soId: string): void;
  _linkDeliveryFromRef: string;
  readonly linkDeliveryFromRef: string;
  // Hubungkan Dokumen — Invoice loads from PFI (metadata) + Delivery (line items)
  linkInvoicePFIId: string;
  linkInvoiceDeliveryId: string;
  readonly linkInvoicePFIOptions: { id: string; doc_no: string; party_name: string }[];
  readonly linkInvoiceDeliveryOptions: { id: string; doc_no: string; party_name: string }[];
  linkInvoiceFromPFI(pfiId: string): void;
  linkInvoiceFromDelivery(deliveryId: string): void;
  _linkInvoicePFIRef: string;
  _linkInvoiceDeliveryRef: string;
  readonly linkInvoicePFIRef: string;
  readonly linkInvoiceDeliveryRef: string;
  _linkInvoicePaymentTerms: string;
  readonly linkInvoicePaymentTerms: string;
  // Per-module Opsi panel visibility
  readonly showMarginPreview: boolean;
  readonly showConfig: boolean;
}

export function docStore(): DocStore {
  return {
    currentId: "doc_0001",
    pageLayout: "stack",
    type: "quotation",
    direction: "jual",
    optionsVisible: true,
    docsVersion: 0,
    lastNewId: "",
    status: "draft" as DocumentStatus,
    revisionCount: 0,
    savedAt: undefined as string | undefined,
    isRevising: false,
    ppnIncluded: true,
    marketingStaffId: "",
    shippingMode: "free",  // default: seller absorbs shipping (Free Ongkir)
    shippingCost: 0,
    shippingCostInclude: 0,
    komisi: 0,
    // Hubungkan Dokumen
    linkQuotationId: "",
    editingLink: {} as Record<string, boolean>,
    // PFI loads from SO
    linkSalesOrderId: "",

    setCurrent(id: string) {
      this.currentId = id;
      // Per-doc scratch (shipping/komisi) resets when navigating.
      // Mockup: not persisted per-doc. When PocketBase lands, these become
      // fields on Document.
      this.shippingMode = "free";
      this.shippingCost = 0;
      this.shippingCostInclude = 0;
      this.komisi = 0;
      const doc = documentById(id);
      if (doc) {
        this.pageLayout = doc.page_layout;
        this.syncFromDoc(doc);
      }
      updateHash(this.type, this.direction, id);
    },
    setLayout(layout: PageLayout) {
      this.pageLayout = layout;
    },
    setType(type: DocumentType, direction: DocDirection) {
      this.type = type;
      this.direction = direction;
      // Per-spec: Opsi (Margin Preview + Konfigurasi) is per-module, not
      // carried over between Penawaran → SO → PO etc. Tampilan (pageLayout)
      // IS a user-level preference and persists. Reset komisi, both ongkos
      // kirim, PPN mode, and marketing staff on every type switch.
      this.shippingMode = "free";
      this.shippingCost = 0;
      this.shippingCostInclude = 0;
      this.komisi = 0;
      this.ppnIncluded = true;
      this.marketingStaffId = "";
      updateHash(type, direction, this.currentId);
      const first = documentsByType(type)[0];
      if (first) this.setCurrent(first.id);
    },
    syncFromDoc(doc: Document) {
      this.status = doc.status;
      this.revisionCount = doc.revision_count;
      this.savedAt = doc.saved_at;
    },

    // ── Document lifecycle actions ──────────────────────────────
    save() {
      const doc = documentById(this.currentId);
      if (!doc) return;
      doc.status = "sent";
      doc.saved_at = new Date().toISOString();
      this.isRevising = false;
      this.syncFromDoc(doc);
      // Persist to PocketBase (fire-and-forget)
      saveCurrentDoc(this.currentId);
    },
    revise() {
      const doc = documentById(this.currentId);
      if (!doc) return;
      if (doc.revision_count >= MAX_REVISIONS) return;
      doc.revision_count += 1;
      doc.last_revision_at = new Date().toISOString();
      doc.status = "draft";
      this.isRevising = true;
      this.syncFromDoc(doc);
    },
    // Batal revisi — see pdferp_skills "Batal revisi" production seam.
    // Mockup: rolls back status/revision_count; field values edited during
    // the revision are NOT restored here (production = DB re-fetch).
    cancelRevise() {
      if (!this.isRevising) return;
      const doc = documentById(this.currentId);
      if (!doc) return;
      doc.revision_count = Math.max(0, doc.revision_count - 1);
      doc.status = "sent";
      doc.last_revision_at = undefined;
      doc.saved_at = undefined;
      this.isRevising = false;
      this.syncFromDoc(doc);
      htmx.ajax("get", `/partials/${this.type.replace(/_/g, "-")}.html`, {
        target: "#doc-body",
        swap: "innerHTML",
      });
    },

    get currentDoc(): Document | undefined {
      return documentById(this.currentId);
    },
    get canRevise(): boolean {
      return this.status === "sent" && this.revisionCount < MAX_REVISIONS;
    },
    get isLocked(): boolean {
      return this.status === "sent";
    },
    get isEditable(): boolean {
      return this.status === "draft";
    },
    get canCancel(): boolean {
      return this.isRevising;
    },

    print() {
      window.print();
    },
    download() {
      // TODO: when BFF lands, hit /documents/:id/download for PDF.
      window.print();
    },

    isNewEmpty(docId: string): boolean {
      const d = documentById(docId);
      if (!d) return false;
      const hasParty = !!d.party_id && !!partyById(d.party_id)?.name;
      const hasLines = linesByDocument(docId).length > 0;
      return !hasParty && !hasLines;
    },

    // ── Margin aggregates (for Margin Preview panel) ────────────
    // Formula (per spec): margin = total_jual + ongkos_kirim_customer
    //                            − total_beli − komisi − potensi_pajak
    //   totalSell    = Σ (qty × unit_price)         — gross sell value
    //   shippingCost = Ongkos Kirim (Customer): +margin (revenue from buyer)
    //   totalBuy     = Σ (qty × buy_per_unit)       — HPP / cost of goods
    //   komisi       — sales commission:           −margin
    //   potensiPajak — net VAT payable:            −margin
    //   shippingCostInclude (Ongkos Kirim Include) is tracked separately
    //   in the panel but is NOT in this formula — it represents what we
    //   pay to the expedition (a real cost, but factored into the buy
    //   price already, not an additional deduction).
    get totalSell(): number {
      void this.docsVersion; // re-evaluate when lines change (e.g., linkQuotation)
      const lines = linesByDocument(this.currentId);
      return lines.reduce((sum, l) => sum + l.qty * l.unit_price, 0);
    },
    get totalBuy(): number {
      void this.docsVersion;
      const lines = linesByDocument(this.currentId);
      return lines.reduce((sum, l) => {
        if (l.pricing) return sum + l.pricing.buy_per_unit * l.qty;
        return sum;
      }, 0);
    },
    // Margin logic (v0.4.2):
    //   shippingMode "bebankan" (customer pays) → +shippingCost, ignore internal
    //   shippingMode "free"     (seller absorbs) → -shippingCostInclude
    get totalMargin(): number {
      if (this.shippingMode === "bebankan") {
        return this.totalSell + this.shippingCost
             - this.totalBuy
             - this.komisi
             - this.potensiPajak;
      }
      // free
      return this.totalSell
           - this.totalBuy
           - this.shippingCostInclude
           - this.komisi
           - this.potensiPajak;
    },
    get totalMarginPct(): number {
      if (this.totalBuy === 0) return 0;
      return (this.totalMargin / this.totalBuy) * 100;
    },
    // Komisi as % of gross sell — answers: "of every Rp 100 sold, how
    // much goes to commission?". Useful for sales-team rate monitoring.
    get komisiPct(): number {
      if (this.totalSell === 0) return 0;
      return (this.komisi / this.totalSell) * 100;
    },
    get marketingStaffName(): string {
      return staffById(this.marketingStaffId)?.name || "";
    },
    // ── Document title (formal uppercase, shown in header) ──────────
    // Single source of truth — every partial reads $store.doc.docTitle.
    get docTitle(): string {
      const titles: Record<DocumentType, string> = {
        quotation: "QUOTATION",
        sales_order: "SALES ORDER",
        proforma_invoice: "PROFORMA INVOICE",
        delivery: "SURAT JALAN",
        pickup: "PICKUP MEMO",
        invoice: "INVOICE",
        po: "PURCHASE ORDER",
        payment: "BUKTI PEMBAYARAN",
      };
      return titles[this.type] ?? "—";
    },
    // Direction subtitle for PFI/Delivery/Invoice. Empty for others.
    get docTitleSub(): string {
      if (this.type === "proforma_invoice" || this.type === "invoice") {
        return this.direction === "jual" ? "Penjualan" : "Pembelian";
      }
      return "";
    },

    // ── PPN potential (auto-calculated) ─────────────────────────
    // Per spec: buy prices entered in pricing modal are INCLUDE PPN, so
    // PPN_masuk per line = buy_per_unit × qty × 11/111. PPN_keluar
    // extracted from totalSell using the same convention as calc.ts:
    //   ppn = include × 11/111 = include − include/1.11.
    // Potensi Pajak = what we owe (keluaran) − what we can claim (masukan).
    get ppnKeluaran(): number {
      return this.totalSell * 11 / 111;
    },
    get ppnMasukan(): number {
      void this.docsVersion;
      const lines = linesByDocument(this.currentId);
      return lines.reduce((sum, l) => {
        if (!l.pricing) return sum;
        return sum + l.pricing.buy_per_unit * l.qty * 11 / 111;
      }, 0);
    },
    get potensiPajak(): number {
      return this.ppnKeluaran - this.ppnMasukan;
    },

    setPpnIncluded(value: boolean) {
      this.ppnIncluded = value;
    },
    setMarketingStaff(id: string) {
      this.marketingStaffId = id;
    },
    setShippingMode(value: "free" | "bebankan") {
      this.shippingMode = value;
    },
    setShippingCost(value: number) {
      this.shippingCost = value;
    },
    setShippingCostInclude(value: number) {
      this.shippingCostInclude = value;
    },
    setKomisi(value: number) {
      this.komisi = value;
    },

    // ── Hubungkan Dokumen (SO only) ───────────────────────────
    get linkQuotationOptions(): { id: string; doc_no: string; party_name: string }[] {
      return documentsByType("quotation")
        .filter((q) => q.status === "sent")
        .map((q) => ({
          id: q.id,
          doc_no: q.doc_no,
          party_name: q.party_id ? (partyById(q.party_id)?.name || "") : "",
        }));
    },
    linkDoc(): Document | undefined {
      return documentById(this.currentId);
    },
    linkQuotation(quotationId: string) {
      const soDoc = this.linkDoc();
      const qDoc = documentById(quotationId);
      if (!soDoc || !qDoc || qDoc.type !== "quotation") return;
      this.linkQuotationId = quotationId;

      // Copy all relevant fields from quotation → SO.
      soDoc.parent_doc_id = quotationId;
      soDoc.party_id = qDoc.party_id;               // customer
      soDoc.shipping_terms = qDoc.shipping_terms;    // Franco/Locco/etc
      soDoc.shipping_address = qDoc.shipping_address;
      soDoc.subject = "Sales Order";
      soDoc.date = new Date().toISOString().slice(0, 10); // today

      // Marketing staff — copy from quotation to both doc + store.
      soDoc.marketing_staff_id = qDoc.marketing_staff_id;
      this.marketingStaffId = qDoc.marketing_staff_id || "";

      // Jatuh tempo: from quotation's payment_net_days (if NETT).
      if (qDoc.payment_method === "nett" && (qDoc.payment_net_days ?? 0) > 0) {
        const d = new Date();
        d.setDate(d.getDate() + qDoc.payment_net_days!);
        soDoc.due_date = d.toISOString().slice(0, 10);
      }
      // Copy payment info to SO
      soDoc.payment_method = qDoc.payment_method;
      soDoc.payment_net_days = qDoc.payment_net_days;
      soDoc.due_date_ref = qDoc.due_date_ref;
      // Store for display in the Opsi panel.
      this._linkCreditDays = qDoc.payment_net_days ?? 0;
      this._linkQuotationDocNo = qDoc.doc_no;

      // Clone line items + pricing from quotation.
      for (let i = documentLines.length - 1; i >= 0; i--) {
        if (documentLines[i].document_id === soDoc.id) {
          documentLines.splice(i, 1);
        }
      }
      const ts = Date.now();
      const qLines = linesByDocument(quotationId);
      qLines.forEach((ql, idx) => {
        const cloned: DocumentLine = {
          ...ql,
          id: `dl_so_${ts}_${idx}`,
          document_id: soDoc.id,
          line_no: idx + 1,
          pricing: ql.pricing
            ? { ...ql.pricing, id: `lp_so_${ts}_${idx}`, line_id: `dl_so_${ts}_${idx}` }
            : undefined,
        };
        documentLines.push(cloned);
      });
      this.docsVersion++;

      // Reload the body partial so the cloned lines appear. We do this
      // explicitly instead of relying on loadBody() watching docsVersion
      // (which would also fire on every qty edit and clobber the input).
      const filename = soDoc.type.replace(/_/g, "-") + ".html";
      htmx.ajax("get", `/partials/${filename}`, {
        target: "#doc-body",
        swap: "innerHTML",
      });
    },
    // Internal: jatuh tempo info from last linkQuotation call.
    _linkCreditDays: 0,
    _linkQuotationDocNo: "",
    get linkJatuhTempo(): string {
      if (this._linkCreditDays > 0) {
        return `Nett ${this._linkCreditDays} Hari`;
      }
      return (this.linkQuotationId || this.linkSalesOrderId) ? "Cash" : "—";
    },
    get linkQuotationRef(): string {
      return this._linkQuotationDocNo || "";
    },

    // ── Hubungkan Dokumen — PFI loads from Sales Order ──────────
    get linkSalesOrderOptions(): { id: string; doc_no: string; party_name: string }[] {
      return documentsByType("sales_order")
        .filter((so) => so.status === "sent")
        .map((so) => ({
          id: so.id,
          doc_no: so.doc_no,
          party_name: so.party_id ? (partyById(so.party_id)?.name || "") : "",
        }));
    },
    _linkSoDocNo: "",
    _linkPaymentTerms: "",
    // PO creation from SO
    linkPODocId: "",
    selectedPOSupplierIds: [] as string[],
    _linkPOFromDocNo: "",
    // PFI BELI loads from PO
    linkPFIBeliPOId: "",
    _linkPFIBeliRef: "",
    // Delivery loads from SO
    linkDeliverySOId: "",
    _linkDeliveryFromRef: "",
    // Invoice loads from PFI + Delivery
    linkInvoicePFIId: "",
    linkInvoiceDeliveryId: "",
    _linkInvoicePFIRef: "",
    _linkInvoiceDeliveryRef: "",
    _linkInvoicePaymentTerms: "",
    get linkPOFrom(): string {
      return this._linkPOFromDocNo || "";
    },
    // Payment terms derived from current PO's document-level payment_net_days.
    get poPaymentTerms(): string {
      if (this.type !== "po") return "";
      const doc = documentById(this.currentId);
      if (!doc) return "";
      if (doc.payment_method === "nett" && (doc.payment_net_days ?? 0) > 0) {
        return `NETT ${doc.payment_net_days} Hari`;
      }
      return "Cash";
    },
    get linkSoRef(): string {
      return this._linkSoDocNo || "";
    },
    get linkPaymentTerms(): string {
      return this._linkPaymentTerms || (this.linkSalesOrderId ? "—" : "");
    },

    // ── Hubungkan Dokumen — PO loads from Sales Order ──────────
    get linkPurchaseOrderOptions(): { id: string; doc_no: string; party_name: string }[] {
      return documentsByType("sales_order")
        .filter((so) => so.status === "sent")
        .map((so) => ({
          id: so.id,
          doc_no: so.doc_no,
          party_name: so.party_id ? (partyById(so.party_id)?.name || "") : "",
        }));
    },
    // Aggregate suppliers from the selected SO's line pricings.
    get linkPOSuppliers(): { id: string; name: string; lineCount: number }[] {
      if (!this.linkPODocId) return [];
      const soLines = linesByDocument(this.linkPODocId);
      const map = new Map<string, { name: string; count: number }>();
      soLines.forEach((l) => {
        const sid = l.pricing?.supplier_id;
        const sname = l.pricing?.supplier_name || "";
        if (sid) {
          const entry = map.get(sid);
          if (entry) {
            entry.count++;
          } else {
            map.set(sid, { name: sname, count: 1 });
          }
        }
      });
      const result: { id: string; name: string; lineCount: number }[] = [];
      map.forEach((v, k) => result.push({ id: k, name: v.name, lineCount: v.count }));
      return result;
    },
    startPOCreation(soId: string) {
      this.linkPODocId = soId;
      const soDoc = documentById(soId);
      this._linkPOFromDocNo = soDoc?.doc_no || "";
      const suppliers = this.linkPOSuppliers;
      // Auto-select all suppliers if 1, otherwise let user pick
      if (suppliers.length === 1) {
        this.selectedPOSupplierIds = [suppliers[0].id];
      } else {
        this.selectedPOSupplierIds = suppliers.map((s) => s.id); // all checked by default
      }
    },
    createPOFromSO() {
      const soDoc = documentById(this.linkPODocId);
      if (!soDoc || soDoc.type !== "sales_order") return;
      const soLines = linesByDocument(this.linkPODocId);
      const selectedIds = this.selectedPOSupplierIds;
      if (selectedIds.length === 0) return;

      // Create one PO per selected supplier.
      selectedIds.forEach((supplierId) => {
        const today = new Date().toISOString().slice(0, 10);
        const year = new Date().getFullYear();
        const poId = "doc_po_new_" + Date.now() + "_" + supplierId;
        const poDoc: Document = {
          id: poId,
          doc_no: nextDocNo("po", year, documents),
          type: "po",
          direction: "beli",
          date: today,
          subject: "Purchase Order",
          salutation: "Dengan Hormat,\nKami memesan material berikut dari Bapak/Ibu:",
          status: "draft",
          page_layout: "stack",
          revision_count: 0,
          company_id: "co_rembulan_aurora",
          party_id: supplierId,
          signatory_id: "si_winarto",
          parent_doc_id: this.linkPODocId,
          marketing_staff_id: soDoc.marketing_staff_id,
          shipping_address: soDoc.shipping_address,
          shipping_terms: soDoc.shipping_terms,
        };
        // Compute due_date from SO's payment_net_days.
        if (soDoc.payment_method === "nett" && (soDoc.payment_net_days ?? 0) > 0) {
          const d = new Date();
          d.setDate(d.getDate() + soDoc.payment_net_days!);
          poDoc.due_date = d.toISOString().slice(0, 10);
        }
        // Copy payment info to PO
        poDoc.payment_method = soDoc.payment_method;
        poDoc.payment_net_days = soDoc.payment_net_days;
        poDoc.due_date_ref = soDoc.due_date_ref;
        documents.push(poDoc);

        // Clone only lines belonging to this supplier.
        const supplierLines = soLines.filter((l) => l.pricing?.supplier_id === supplierId);
        const ts = Date.now();
        supplierLines.forEach((sl, idx) => {
          const cloned: DocumentLine = {
            ...sl,
            id: `dl_po_${ts}_${supplierId}_${idx}`,
            document_id: poId,
            line_no: idx + 1,
            pricing: sl.pricing
              ? { ...sl.pricing, id: `lp_po_${ts}_${supplierId}_${idx}`, line_id: `dl_po_${ts}_${supplierId}_${idx}` }
              : undefined,
          };
          documentLines.push(cloned);
        });
      });

      this.docsVersion++;
      // Navigate to the first created PO.
      const firstPO = documents.find((d) => d.type === "po" && d.direction === "beli" && d.parent_doc_id === this.linkPODocId);
      if (firstPO) {
        this.setCurrent(firstPO.id);
      }
    },
    // ── Per-module Opsi panel visibility ────────────────────────
    // Margin Preview + Konfigurasi: only modules that deal with
    // pricing, shipping, marketing, and PPN. PFI (both directions)
    // excluded — purchase-side has its own form; JUAL-side has giro/cek
    // and bukti sections instead.
    get showMarginPreview(): boolean {
      return ["quotation", "sales_order"].includes(this.type);
    },
    get showConfig(): boolean {
      return ["quotation", "sales_order"].includes(this.type);
    },
    linkSalesOrder(soId: string) {
      const pfiDoc = this.linkDoc();
      const soDoc = documentById(soId);
      if (!pfiDoc || !soDoc || soDoc.type !== "sales_order") return;
      this.linkSalesOrderId = soId;

      // Copy relevant fields from SO → PFI.
      pfiDoc.parent_doc_id = soId;
      pfiDoc.party_id = soDoc.party_id;
      pfiDoc.shipping_terms = soDoc.shipping_terms;
      pfiDoc.shipping_address = soDoc.shipping_address;
      pfiDoc.marketing_staff_id = soDoc.marketing_staff_id;
      this.marketingStaffId = soDoc.marketing_staff_id || "";
      pfiDoc.subject = "Proforma Invoice";
      pfiDoc.date = new Date().toISOString().slice(0, 10); // today
      // PFI jatuh tempo = from SO's payment_net_days.
      if (soDoc.payment_method === "nett" && (soDoc.payment_net_days ?? 0) > 0) {
        const d = new Date();
        d.setDate(d.getDate() + soDoc.payment_net_days!);
        pfiDoc.due_date = d.toISOString().slice(0, 10);
      }
      // Copy payment info to PFI
      pfiDoc.payment_method = soDoc.payment_method;
      pfiDoc.payment_net_days = soDoc.payment_net_days;
      pfiDoc.due_date_ref = soDoc.due_date_ref;
      const nd = soDoc.payment_net_days ?? 0;
      this._linkCreditDays = nd;
      this._linkSoDocNo = soDoc.doc_no;
      // Payment terms string.
      if (soDoc.payment_method === "nett" && nd > 0) {
        this._linkPaymentTerms = `NETT ${nd} Hari`;
      } else {
        this._linkPaymentTerms = "Cash";
      }

      // Clone line items from SO.
      const soLines = linesByDocument(soId);
      for (let i = documentLines.length - 1; i >= 0; i--) {
        if (documentLines[i].document_id === pfiDoc.id) {
          documentLines.splice(i, 1);
        }
      }
      const ts = Date.now();
      soLines.forEach((sl, idx) => {
        const cloned: DocumentLine = {
          ...sl,
          id: `dl_pfi_${ts}_${idx}`,
          document_id: pfiDoc.id,
          line_no: idx + 1,
          pricing: sl.pricing
            ? { ...sl.pricing, id: `lp_pfi_${ts}_${idx}`, line_id: `dl_pfi_${ts}_${idx}` }
            : undefined,
        };
        documentLines.push(cloned);
      });
      this.docsVersion++;

      // Reload body partial.
      const filename = pfiDoc.type.replace(/_/g, "-") + ".html";
      htmx.ajax("get", `/partials/${filename}`, {
        target: "#doc-body",
        swap: "innerHTML",
      });
    },
    // ── Hubungkan Dokumen — PFI BELI loads from Purchase Order ──
    get linkPFIBeliPOOptions(): { id: string; doc_no: string; party_name: string }[] {
      return documentsByType("po")
        .filter((po) => po.status === "sent")
        .map((po) => ({
          id: po.id,
          doc_no: po.doc_no,
          party_name: po.party_id ? (partyById(po.party_id)?.name || "") : "",
        }));
    },
    get linkPFIBeliFrom(): string {
      return this._linkPFIBeliRef || "";
    },
    linkPFIBeliPO(poId: string) {
      const pfiDoc = this.linkDoc();
      const poDoc = documentById(poId);
      if (!pfiDoc || !poDoc || poDoc.type !== "po") return;
      this.linkPFIBeliPOId = poId;

      // Copy relevant fields from PO → PFI BELI.
      pfiDoc.parent_doc_id = poId;
      pfiDoc.party_id = poDoc.party_id;
      pfiDoc.shipping_terms = poDoc.shipping_terms;
      pfiDoc.shipping_address = poDoc.shipping_address;
      pfiDoc.subject = "Proforma Invoice Pembelian";
      pfiDoc.date = new Date().toISOString().slice(0, 10);
      // Payment info: copy from PO.
      pfiDoc.payment_method = poDoc.payment_method;
      pfiDoc.payment_net_days = poDoc.payment_net_days;
      pfiDoc.due_date_ref = poDoc.due_date_ref;
      if (poDoc.payment_method === "nett" && (poDoc.payment_net_days ?? 0) > 0) {
        const d = new Date();
        d.setDate(d.getDate() + poDoc.payment_net_days!);
        pfiDoc.due_date = d.toISOString().slice(0, 10);
      }
      // Auto-load supplier bank from party.
      const party = partyById(poDoc.party_id || "");
      if (party) {
        pfiDoc.supplier_bank_name = party.bank_name || "";
        pfiDoc.supplier_bank_account = party.bank_account || "";
        pfiDoc.supplier_bank_account_name = party.bank_account_name || "";
      }
      this._linkPFIBeliRef = poDoc.doc_no;

      // Clone line items from PO.
      const poLines = linesByDocument(poId);
      for (let i = documentLines.length - 1; i >= 0; i--) {
        if (documentLines[i].document_id === pfiDoc.id) {
          documentLines.splice(i, 1);
        }
      }
      const ts = Date.now();
      poLines.forEach((pl, idx) => {
        const cloned: DocumentLine = {
          ...pl,
          id: `dl_pfi_beli_${ts}_${idx}`,
          document_id: pfiDoc.id,
          line_no: idx + 1,
          pricing: pl.pricing
            ? { ...pl.pricing, id: `lp_pfi_beli_${ts}_${idx}`, line_id: `dl_pfi_beli_${ts}_${idx}` }
            : undefined,
        };
        documentLines.push(cloned);
      });
      this.docsVersion++;

      // Reload body partial.
      const filename = pfiDoc.type.replace(/_/g, "-") + ".html";
      htmx.ajax("get", `/partials/${filename}`, {
        target: "#doc-body",
        swap: "innerHTML",
      });
    },
    // ── Hubungkan Dokumen — Delivery loads from Sales Order ──
    get linkDeliverySOOptions(): { id: string; doc_no: string; party_name: string }[] {
      return documentsByType("sales_order")
        .filter((so) => so.status === "sent")
        .map((so) => ({
          id: so.id,
          doc_no: so.doc_no,
          party_name: so.party_id ? (partyById(so.party_id)?.name || "") : "",
        }));
    },
    get linkDeliveryFromRef(): string {
      return this._linkDeliveryFromRef || "";
    },
    linkDeliveryFromSO(soId: string) {
      const sjDoc = this.linkDoc();
      const soDoc = documentById(soId);
      if (!sjDoc || !soDoc || soDoc.type !== "sales_order") return;
      this.linkDeliverySOId = soId;

      // Copy relevant fields from SO → Delivery.
      sjDoc.parent_doc_id = soId;
      sjDoc.party_id = soDoc.party_id;
      sjDoc.shipping_terms = soDoc.shipping_terms;
      sjDoc.shipping_address = soDoc.shipping_address;
      sjDoc.subject = "Surat Jalan";
      sjDoc.date = new Date().toISOString().slice(0, 10);
      this._linkDeliveryFromRef = soDoc.doc_no;

      // Clone line items from SO.
      const soLines = linesByDocument(soId);
      for (let i = documentLines.length - 1; i >= 0; i--) {
        if (documentLines[i].document_id === sjDoc.id) {
          documentLines.splice(i, 1);
        }
      }
      const ts = Date.now();
      soLines.forEach((sl, idx) => {
        const cloned: DocumentLine = {
          ...sl,
          id: `dl_sj_${ts}_${idx}`,
          document_id: sjDoc.id,
          line_no: idx + 1,
          pricing: sl.pricing
            ? { ...sl.pricing, id: `lp_sj_${ts}_${idx}`, line_id: `dl_sj_${ts}_${idx}` }
            : undefined,
        };
        documentLines.push(cloned);
      });
      this.docsVersion++;

      // Reload body partial.
      const filename = sjDoc.type.replace(/_/g, "-") + ".html";
      htmx.ajax("get", `/partials/${filename}`, {
        target: "#doc-body",
        swap: "innerHTML",
      });
    },
    // ── Hubungkan Dokumen — Invoice loads from PFI + Delivery ──
    get linkInvoicePFIOptions(): { id: string; doc_no: string; party_name: string }[] {
      return documentsByType("proforma_invoice")
        .filter((pfi) => pfi.status === "sent" && pfi.direction === "jual")
        .map((pfi) => ({
          id: pfi.id,
          doc_no: pfi.doc_no,
          party_name: pfi.party_id ? (partyById(pfi.party_id)?.name || "") : "",
        }));
    },
    get linkInvoiceDeliveryOptions(): { id: string; doc_no: string; party_name: string }[] {
      return documentsByType("delivery")
        .filter((d) => d.status === "sent")
        .map((d) => ({
          id: d.id,
          doc_no: d.doc_no,
          party_name: d.party_id ? (partyById(d.party_id)?.name || "") : "",
        }));
    },
    get linkInvoicePFIRef(): string {
      return this._linkInvoicePFIRef || "";
    },
    get linkInvoiceDeliveryRef(): string {
      return this._linkInvoiceDeliveryRef || "";
    },
    get linkInvoicePaymentTerms(): string {
      return this._linkInvoicePaymentTerms || "";
    },
    // Load metadata from PFI (customer, shipping, payment terms, due date) — NO line items.
    linkInvoiceFromPFI(pfiId: string) {
      const invDoc = this.linkDoc();
      const pfiDoc = documentById(pfiId);
      if (!invDoc || !pfiDoc || pfiDoc.type !== "proforma_invoice") return;
      this.linkInvoicePFIId = pfiId;

      invDoc.parent_doc_id = pfiId;
      invDoc.party_id = pfiDoc.party_id;
      invDoc.shipping_terms = pfiDoc.shipping_terms;
      invDoc.shipping_address = pfiDoc.shipping_address;
      invDoc.marketing_staff_id = pfiDoc.marketing_staff_id;
      this.marketingStaffId = pfiDoc.marketing_staff_id || "";
      invDoc.subject = "Invoice";
      invDoc.date = new Date().toISOString().slice(0, 10);
      // Payment info from PFI
      invDoc.payment_method = pfiDoc.payment_method;
      invDoc.payment_net_days = pfiDoc.payment_net_days;
      invDoc.due_date_ref = pfiDoc.due_date_ref;
      if (pfiDoc.payment_method === "nett" && (pfiDoc.payment_net_days ?? 0) > 0) {
        const d = new Date();
        d.setDate(d.getDate() + pfiDoc.payment_net_days!);
        invDoc.due_date = d.toISOString().slice(0, 10);
      }
      this._linkInvoicePFIRef = pfiDoc.doc_no;
      const nd = pfiDoc.payment_net_days ?? 0;
      if (pfiDoc.payment_method === "nett" && nd > 0) {
        this._linkInvoicePaymentTerms = `NETT ${nd} Hari`;
      } else {
        this._linkInvoicePaymentTerms = "Cash";
      }
    },
    // Load line items from Delivery (Surat Jalan) — barang yang benar-benar terkirim.
    linkInvoiceFromDelivery(deliveryId: string) {
      const invDoc = this.linkDoc();
      const delDoc = documentById(deliveryId);
      if (!invDoc || !delDoc || delDoc.type !== "delivery") return;
      this.linkInvoiceDeliveryId = deliveryId;

      // Also copy party if not already set from PFI.
      if (!invDoc.party_id) {
        invDoc.party_id = delDoc.party_id;
        invDoc.shipping_terms = delDoc.shipping_terms;
        invDoc.shipping_address = delDoc.shipping_address;
      }
      this._linkInvoiceDeliveryRef = delDoc.doc_no;

      // Clone line items from delivery.
      const delLines = linesByDocument(deliveryId);
      for (let i = documentLines.length - 1; i >= 0; i--) {
        if (documentLines[i].document_id === invDoc.id) {
          documentLines.splice(i, 1);
        }
      }
      const ts = Date.now();
      delLines.forEach((dl, idx) => {
        const cloned: DocumentLine = {
          ...dl,
          id: `dl_inv_${ts}_${idx}`,
          document_id: invDoc.id,
          line_no: idx + 1,
          pricing: dl.pricing
            ? { ...dl.pricing, id: `lp_inv_${ts}_${idx}`, line_id: `dl_inv_${ts}_${idx}` }
            : undefined,
        };
        documentLines.push(cloned);
      });
      this.docsVersion++;

      // Reload body partial.
      const filename = invDoc.type.replace(/_/g, "-") + ".html";
      htmx.ajax("get", `/partials/${filename}`, {
        target: "#doc-body",
        swap: "innerHTML",
      });
    },
    updateLinkField(field: string, value: string) {
      const doc = this.linkDoc();
      if (!doc) return;
      (doc as unknown as Record<string, unknown>)[field] = value;
    },
    // Bump docsVersion so financial getters (totalSell, totalBuy, …)
    // re-evaluate after line mutations done outside linkQuotation —
    // e.g., qty edits in the document body, addLine/removeLine, or
    // pricingCalculator.apply(). The store getters read raw
    // documentLines objects (not Alpine proxies), so without this
    // nudge Alpine never notices the data changed.
    touch() {
      this.docsVersion++;
    },

    get hasEmptyNew(): boolean {
      return documents.some((d) => this.isNewEmpty(d.id));
    },
    addNew() {
      if (this.hasEmptyNew) return;
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const year = today.getFullYear();
      const id = "doc_new_" + Date.now();
      const doc: Document = {
        id,
        doc_no: nextDocNo(this.type, year, documents),
        type: this.type,
        direction: this.direction,
        date: todayIso,
        // Per-type subject + salutation (see TYPE_SUBJECT / TYPE_SALUTATION
        // above). Used to be hardcoded "Penawaran Harga" regardless of type.
        subject: TYPE_SUBJECT[this.type],
        salutation: TYPE_SALUTATION[this.type],
        status: "draft",
        page_layout: this.pageLayout, // keep current user layout choice
        revision_count: 0,
        company_id: "co_rembulan_aurora",
        party_id: "",
        signatory_id: "si_winarto",
      };
      documents.push(doc);
      this.docsVersion++;
      this.lastNewId = id;
      this.setCurrent(id);
    },
  };
}
