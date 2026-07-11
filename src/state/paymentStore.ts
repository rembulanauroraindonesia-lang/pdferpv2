/**
 * $store.payment — Pembayaran (Payment) dashboard store.
 * ----------------------------------------------------------------------------
 * Centralized module for ALL payments — both Penjualan (Sales) and Pembelian
 * (Purchase). Entries are computed from `documents[]` where type === 'payment'.
 *
 * When the user clicks "Pembayaran" in the nav, this store powers the
 * dashboard-style view showing all payments in a table format, with
 * the ability to add new payments via a modal form.
 *
 * Syarat Bayar (Payment Terms):
 *   Cash:
 *     - Tunai → upload tanda terima, status: Lunas
 *     - Transfer → upload bukti transfer + info, status: Lunas
 *   Credit (Nett X hari):
 *     - Giro → nomor, bank, nominal, tgl dibuat, tgl jatuh tempo, upload
 *       status: Cair / Ditolak / Bad Debt
 *     - Cek → same as Giro
 *       status: Cair / Ditolak / Bad Debt
 *     - Tempo → tgl mulai, tgl jatuh tempo (dari PFI)
 *       status: Lunas / Telat X Hari / Bad Debt
 *
 * Architecture mirrors dealStore.ts: getter-based reactive computation
 * over the shared `documents[]` array. Only modal/form state is mutable.
 */
import { documents, documentById } from "@/data/documents";
import { linesByDocument } from "@/data/documentLines";
import { partyById } from "@/data/parties";
import { calcTotals } from "@/lib/calc";
import { nextDocNo } from "@/lib/docNo";
import { formatNumber, formatDateID } from "@/lib/format";
import type { Document, DocumentType } from "@/types/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PayDirection = "jual" | "beli";
export type PayTermCategory = "cash" | "credit";
export type PayCashMethod = "tunai" | "transfer";
export type PayCreditMethod = "giro" | "cek" | "tempo";

export type PayStatus =
  | "draft"      // newly created, not yet confirmed
  | "lunas"      // fully paid (cash lunas / tempo paid / giro cair)
  | "cair"       // giro/cek cleared
  | "ditolak"    // giro/cek rejected
  | "bad_debt"   // uncollectible
  | "telat"      // tempo overdue
  | "proses";    // in progress (waiting for payment)

export interface PaymentEntry {
  id: string;                    // document id
  docNo: string;                 // e.g. "PAY/RAI/26/0001"
  direction: PayDirection;
  date: string;
  partyName: string;

  // Linked document
  linkedDocId: string;           // parent_doc_id
  linkedDocNo: string;           // e.g. "INV/RAI/26/0001"
  linkedDocType: string;         // "proforma_invoice" | "invoice"
  linkedDocTypeName: string;     // "Proforma Invoice" | "Invoice"

  // Amounts
  invoiceTotal: number;          // total from linked invoice/PFI
  amountPaid: number;            // payment amount (may differ for partial)

  // Payment terms
  termCategory: PayTermCategory; // "cash" | "credit"
  payChannel: string;            // "tunai" | "transfer" | "giro" | "cek" | "tempo"
  payChannelLabel: string;       // display label
  netDays: number;               // e.g. 30

  // Due date tracking
  startDate?: string;            // tgl mulai (for credit/tempo)
  dueDate?: string;              // tgl jatuh tempo

  // Giro/Cek details
  giroNo?: string;
  giroBank?: string;
  giroAmount?: number;
  giroCreatedDate?: string;
  giroDueDate?: string;

  // Evidence
  proofFile?: string;            // uploaded file name

  // Reference
  paymentRef?: string;           // no. referensi

  // Notes
  notes?: string;

  // Status
  status: PayStatus;
  statusLabel: string;           // human readable
  overdueDays: number;           // 0 if not overdue, >0 if telat

  // Document status (for badge on linked docs)
  docStatus: string;             // "draft" | "sent"
}

export interface LinkableDoc {
  id: string;
  docNo: string;
  partyName: string;
  type: string;
  typeName: string;
  total: number;
  totalLabel: string;
  date: string;
  dateLabel: string;
}

export interface PaymentFormState {
  direction: PayDirection;
  linkedDocId: string;
  termCategory: PayTermCategory;
  cashMethod: PayCashMethod;
  creditMethod: PayCreditMethod;
  netDays: number;
  startDate: string;
  dueDate: string;
  amountPaid: string;  // text input, parsed to number
  giroNo: string;
  giroBank: string;
  giroAmount: string;
  giroCreatedDate: string;
  giroDueDate: string;
  proofFile: string;
  paymentRef: string;
  notes: string;
}

export interface PaymentStore {
  // Data
  readonly entries: PaymentEntry[];
  readonly filteredEntries: PaymentEntry[];

  // Filters
  filterDirection: PayDirection | "";
  filterStatus: PayStatus | "";
  filterSearch: string;

  // Modal state
  modalOpen: boolean;
  editingId: string | null;

  // New entry form (draft)
  form: PaymentFormState;

  // Computed
  readonly entryCount: number;
  readonly filteredCount: number;

  // Linkable documents (for form dropdown) — reactive on direction
  readonly linkableDocs: LinkableDoc[];
  readonly selectedLinkedDoc: LinkableDoc | undefined;

  // Available statuses for status change (depends on term category)
  readonly availableStatuses: { value: PayStatus; label: string }[];

  // Methods
  openModal(id?: string): void;
  closeModal(): void;
  saveEntry(): void;
  removeEntry(id: string): void;
  updateStatus(id: string, status: PayStatus): void;

  // Badge helper — given any document ID, find if there's a payment linked to it
  getPaymentBadgeForDoc(docId: string): { status: PayStatus; label: string; cssClass: string } | null;

  // Formatting helpers exposed to template
  fmtMoney(n: number): string;
  fmtDate(iso: string): string;
  fmtNum(n: number): string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PayStatus, string> = {
  draft: "Draft",
  lunas: "Lunas",
  cair: "Cair",
  ditolak: "Ditolak",
  bad_debt: "Bad Debt",
  telat: "Telat",
  proses: "Proses",
};

const CHANNEL_LABELS: Record<string, string> = {
  tunai: "Tunai",
  transfer: "Transfer",
  giro: "Giro",
  cek: "Cek",
  tempo: "Tempo",
};

/** Number of days from a date string to today (positive = past / overdue). */
function daysBetween(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = today.getTime() - target.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Infer the full pay_channel from document fields. */
function resolvePayChannel(doc: Document): string {
  // Direct channel field (new payments)
  if (doc.pay_channel) return doc.pay_channel;

  // Legacy: infer from giro_no
  if (doc.giro_no) return "giro";

  // Legacy: infer from payment_method
  if (doc.payment_method === "cash") return "tunai";
  if (doc.payment_method === "nett") return "tempo";

  return "tunai";
}

/** Resolve the PaymentEntry status from the underlying Document. */
function resolvePayStatus(
  doc: Document,
  termCategory: PayTermCategory,
  payChannel: string,
): { status: PayStatus; overdueDays: number } {
  if (doc.status === "draft") {
    return { status: "draft", overdueDays: 0 };
  }
  if (doc.status === "cancelled") {
    return { status: "bad_debt", overdueDays: 0 };
  }

  // For "sent" or "confirmed" — derive from payment terms.
  if (termCategory === "cash") {
    // Cash (tunai/transfer): always lunas once confirmed
    return { status: "lunas", overdueDays: 0 };
  }

  // Credit — giro / cek
  if (payChannel === "giro" || payChannel === "cek") {
    // Giro/Cek status is managed by user (updateStatus):
    // If doc has giro_cair_date set, assume cair; else proses
    if (doc.giro_cair_date) {
      return { status: "cair", overdueDays: 0 };
    }
    return { status: "proses", overdueDays: 0 };
  }

  // Credit — tempo: check due date
  if (doc.due_date) {
    const overdue = daysBetween(doc.due_date);
    if (overdue > 0) {
      return { status: "telat", overdueDays: overdue };
    }
    return { status: "lunas", overdueDays: 0 };
  }

  // Credit — no due date yet: proses
  return { status: "proses", overdueDays: 0 };
}

/** Build the human-readable status label (Bahasa Indonesia). */
function buildStatusLabel(status: PayStatus, overdueDays: number): string {
  if (status === "telat" && overdueDays > 0) {
    return `Telat ${overdueDays} Hari`;
  }
  return STATUS_LABELS[status] ?? status;
}

/** Map a payment Document to a rich PaymentEntry for the dashboard. */
function buildPaymentEntry(doc: Document): PaymentEntry {
  const party = doc.party_id ? partyById(doc.party_id) : undefined;
  const linkedDoc = doc.parent_doc_id ? documentById(doc.parent_doc_id) : undefined;
  const linkedLines = linkedDoc ? linesByDocument(linkedDoc.id) : [];
  const invoiceTotal = calcTotals(linkedLines).grandTotal;

  const payChannel = resolvePayChannel(doc);
  const termCategory: PayTermCategory =
    (payChannel === "tunai" || payChannel === "transfer") ? "cash" : "credit";

  const { status, overdueDays } = resolvePayStatus(doc, termCategory, payChannel);

  return {
    id: doc.id,
    docNo: doc.doc_no,
    direction: doc.direction as PayDirection,
    date: doc.date,
    partyName: party?.name ?? "\u2014",
    linkedDocId: doc.parent_doc_id ?? "",
    linkedDocNo: linkedDoc?.doc_no ?? "\u2014",
    linkedDocType: linkedDoc?.type ?? "",
    linkedDocTypeName: linkedDoc?.type === "proforma_invoice" ? "Proforma Invoice" : "Invoice",
    invoiceTotal,
    amountPaid: doc.payment_amount ?? invoiceTotal,
    termCategory,
    payChannel,
    payChannelLabel: CHANNEL_LABELS[payChannel] ?? payChannel,
    netDays: doc.payment_net_days ?? 0,
    startDate: doc.date,
    dueDate: doc.due_date,
    giroNo: doc.giro_no,
    giroBank: doc.giro_bank,
    giroAmount: doc.giro_amount,
    giroCreatedDate: doc.giro_created_date,
    giroDueDate: doc.giro_cair_date,
    proofFile: doc.payment_proof_file ?? doc.giro_file,
    paymentRef: doc.payment_ref,
    notes: doc.payment_notes ?? doc.salutation,
    status,
    statusLabel: buildStatusLabel(status, overdueDays),
    overdueDays,
    docStatus: doc.status,
  };
}

/** Return a blank form state for "Add New Payment". */
function blankForm(): PaymentFormState {
  return {
    direction: "jual",
    linkedDocId: "",
    termCategory: "cash",
    cashMethod: "transfer",
    creditMethod: "tempo",
    netDays: 30,
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    amountPaid: "",
    giroNo: "",
    giroBank: "",
    giroAmount: "",
    giroCreatedDate: "",
    giroDueDate: "",
    proofFile: "",
    paymentRef: "",
    notes: "",
  };
}

/** Collect linkable documents for a given direction (jual / beli).
 *  Includes PFI and Invoice with status "sent" or "confirmed" or "invoiced".
 */
function collectLinkableDocs(direction: PayDirection): LinkableDoc[] {
  return documents
    .filter(
      (d) =>
        d.direction === direction &&
        (d.type === "proforma_invoice" || d.type === "invoice") &&
        (d.status === "sent" || d.status === "confirmed" || d.status === "invoiced"),
    )
    .map((d) => {
      const party = d.party_id ? partyById(d.party_id) : undefined;
      const lines = linesByDocument(d.id);
      const total = calcTotals(lines).grandTotal;
      return {
        id: d.id,
        docNo: d.doc_no,
        partyName: party?.name ?? "\u2014",
        type: d.type,
        typeName: d.type === "proforma_invoice" ? "Proforma Invoice" : "Invoice",
        total,
        totalLabel: formatNumber(total),
        date: d.date,
        dateLabel: formatDateID(d.date),
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Store factory
// ─────────────────────────────────────────────────────────────────────────────

export function paymentStore(): PaymentStore {
  return {
    // ── Filters ───────────────────────────────────────────────────────────
    filterDirection: "",
    filterStatus: "",
    filterSearch: "",

    // ── Modal state ───────────────────────────────────────────────────────
    modalOpen: false,
    editingId: null,

    // ── Form ──────────────────────────────────────────────────────────────
    form: blankForm(),

    // ── Computed getters ──────────────────────────────────────────────────

    /** All payment entries derived from documents[]. */
    get entries(): PaymentEntry[] {
      return documents
        .filter((d) => d.type === "payment" && d.status !== "cancelled")
        .map((d) => buildPaymentEntry(d));
    },

    /** Entries after applying direction, status, and search filters. */
    get filteredEntries(): PaymentEntry[] {
      let list = this.entries;

      if (this.filterDirection) {
        list = list.filter((e) => e.direction === this.filterDirection);
      }

      if (this.filterStatus) {
        list = list.filter((e) => e.status === this.filterStatus);
      }

      if (this.filterSearch) {
        const q = this.filterSearch.toLowerCase();
        list = list.filter(
          (e) =>
            e.docNo.toLowerCase().includes(q) ||
            e.partyName.toLowerCase().includes(q) ||
            e.linkedDocNo.toLowerCase().includes(q) ||
            e.payChannelLabel.toLowerCase().includes(q),
        );
      }

      return list;
    },

    get entryCount(): number {
      return this.entries.length;
    },

    get filteredCount(): number {
      return this.filteredEntries.length;
    },

    /** Linkable docs for the currently selected direction in the form. */
    get linkableDocs(): LinkableDoc[] {
      return collectLinkableDocs(this.form.direction);
    },

    /** The selected linked document (for displaying total in form). */
    get selectedLinkedDoc(): LinkableDoc | undefined {
      if (!this.form.linkedDocId) return undefined;
      return this.linkableDocs.find((d) => d.id === this.form.linkedDocId);
    },

    /** Available status transitions based on current entry's term category. */
    get availableStatuses(): { value: PayStatus; label: string }[] {
      if (!this.editingId) return [];
      const entry = this.entries.find((e) => e.id === this.editingId);
      if (!entry) return [];

      if (entry.termCategory === "cash") {
        return [
          { value: "draft", label: "Draft" },
          { value: "lunas", label: "Lunas" },
          { value: "bad_debt", label: "Bad Debt" },
        ];
      }

      // Credit
      if (entry.payChannel === "giro" || entry.payChannel === "cek") {
        return [
          { value: "draft", label: "Draft" },
          { value: "proses", label: "Proses" },
          { value: "cair", label: "Cair" },
          { value: "ditolak", label: "Ditolak" },
          { value: "bad_debt", label: "Bad Debt" },
        ];
      }

      // Tempo
      return [
        { value: "draft", label: "Draft" },
        { value: "proses", label: "Proses" },
        { value: "lunas", label: "Lunas" },
        { value: "telat", label: "Telat" },
        { value: "bad_debt", label: "Bad Debt" },
      ];
    },

    // ── Formatting helpers ────────────────────────────────────────────────
    fmtMoney(n: number): string { return formatNumber(n); },
    fmtDate(iso: string): string { return formatDateID(iso); },
    fmtNum(n: number): string { return formatNumber(n); },

    // ── Methods ───────────────────────────────────────────────────────────

    /** Open the add/edit modal. Pass `id` to edit an existing payment. */
    openModal(id?: string): void {
      if (id) {
        const doc = documentById(id);
        if (doc && doc.type === "payment") {
          this.editingId = id;
          const payChannel = resolvePayChannel(doc);
          const termCategory: PayTermCategory =
            (payChannel === "tunai" || payChannel === "transfer") ? "cash" : "credit";

          this.form = {
            direction: doc.direction as PayDirection,
            linkedDocId: doc.parent_doc_id ?? "",
            termCategory,
            cashMethod: termCategory === "cash" ? (payChannel as PayCashMethod) : "transfer",
            creditMethod: termCategory === "credit" ? (payChannel as PayCreditMethod) : "tempo",
            netDays: doc.payment_net_days ?? 30,
            startDate: doc.date,
            dueDate: doc.due_date ?? "",
            amountPaid: doc.payment_amount != null ? String(doc.payment_amount) : "",
            giroNo: doc.giro_no ?? "",
            giroBank: doc.giro_bank ?? "",
            giroAmount: doc.giro_amount != null ? String(doc.giro_amount) : "",
            giroCreatedDate: doc.giro_created_date ?? "",
            giroDueDate: doc.giro_cair_date ?? "",
            proofFile: doc.payment_proof_file ?? doc.giro_file ?? "",
            paymentRef: doc.payment_ref ?? "",
            notes: doc.payment_notes ?? doc.salutation ?? "",
          };
          this.modalOpen = true;
          return;
        }
      }
      // New entry
      this.editingId = null;
      this.form = blankForm();
      this.modalOpen = true;
    },

    /** Close the modal and reset editing state. */
    closeModal(): void {
      this.modalOpen = false;
      this.editingId = null;
    },

    /** Persist the form data — create a new payment or update existing. */
    saveEntry(): void {
      const f = this.form;
      const today = new Date();
      const year = today.getFullYear();

      // Determine pay_channel from form
      const payChannel = f.termCategory === "cash" ? f.cashMethod : f.creditMethod;
      const isGiroCek = f.termCategory === "credit" && (f.creditMethod === "giro" || f.creditMethod === "cek");

      // Calculate due date for tempo
      let dueDate = f.dueDate || undefined;
      if (f.termCategory === "credit" && f.creditMethod === "tempo" && f.startDate && f.netDays > 0 && !dueDate) {
        const start = new Date(f.startDate + "T00:00:00");
        start.setDate(start.getDate() + f.netDays);
        dueDate = start.toISOString().slice(0, 10);
      }

      // Parse amount
      const amountPaid = f.amountPaid ? parseFloat(f.amountPaid.replace(/\./g, "").replace(",", ".")) || 0 : 0;

      if (this.editingId) {
        // ── Update existing document ──
        const idx = documents.findIndex((d) => d.id === this.editingId);
        if (idx < 0) return;

        const doc = documents[idx];
        doc.direction = f.direction;
        doc.parent_doc_id = f.linkedDocId || undefined;
        doc.payment_method = f.termCategory === "cash" ? "cash" : "nett";
        doc.pay_channel = payChannel;
        doc.payment_net_days = f.termCategory === "credit" ? f.netDays : undefined;
        doc.due_date = dueDate;
        doc.date = f.startDate || today.toISOString().slice(0, 10);
        doc.payment_amount = amountPaid || undefined;
        doc.payment_ref = f.paymentRef || undefined;
        doc.payment_date = f.termCategory === "cash" ? f.startDate : undefined;
        doc.payment_notes = f.notes || undefined;
        doc.salutation = f.notes;
        doc.giro_no = isGiroCek ? f.giroNo || undefined : undefined;
        doc.giro_bank = isGiroCek ? f.giroBank || undefined : undefined;
        doc.giro_amount = isGiroCek ? (parseFloat(f.giroAmount) || undefined) : undefined;
        doc.giro_created_date = isGiroCek ? (f.giroCreatedDate || undefined) : undefined;
        doc.giro_cair_date = isGiroCek ? (f.giroDueDate || undefined) : undefined;
        doc.payment_proof_file = f.proofFile || undefined;

        // Update party from linked doc
        const linkedDoc = f.linkedDocId ? documentById(f.linkedDocId) : undefined;
        if (linkedDoc) {
          doc.party_id = linkedDoc.party_id;
        }
      } else {
        // ── Create new payment document ──
        const docNo = nextDocNo("payment" as DocumentType, year, documents);
        const linkedDoc = f.linkedDocId ? documentById(f.linkedDocId) : undefined;

        const newDoc: Document = {
          id: `doc_pay_${Date.now()}`,
          doc_no: docNo,
          type: "payment",
          direction: f.direction,
          date: f.startDate || today.toISOString().slice(0, 10),
          subject: "Bukti Pembayaran",
          salutation: f.notes,
          payment_notes: f.notes,
          status: "draft",
          page_layout: "stack",
          revision_count: 0,
          company_id: "co_rembulan_aurora",
          party_id: linkedDoc?.party_id ?? "",
          signatory_id: "si_winarto",
          parent_doc_id: f.linkedDocId || undefined,
          payment_method: f.termCategory === "cash" ? "cash" : "nett",
          pay_channel: payChannel,
          payment_net_days: f.termCategory === "credit" ? f.netDays : undefined,
          due_date: dueDate,
          payment_amount: amountPaid || undefined,
          payment_ref: f.paymentRef || undefined,
          payment_date: f.termCategory === "cash" ? f.startDate : undefined,
          giro_no: isGiroCek ? f.giroNo || undefined : undefined,
          giro_bank: isGiroCek ? f.giroBank || undefined : undefined,
          giro_amount: isGiroCek ? (parseFloat(f.giroAmount) || undefined) : undefined,
          giro_created_date: isGiroCek ? (f.giroCreatedDate || undefined) : undefined,
          giro_cair_date: isGiroCek ? (f.giroDueDate || undefined) : undefined,
          payment_proof_file: f.proofFile || undefined,
        };

        documents.push(newDoc);
      }

      this.closeModal();
    },

    /** Soft-remove a payment by marking its document as cancelled. */
    removeEntry(id: string): void {
      const idx = documents.findIndex((d) => d.id === id);
      if (idx >= 0) {
        documents[idx].status = "cancelled";
      }
    },

    /**
     * Manually update the status of a payment.
     * Maps PayStatus to the underlying DocumentStatus:
     *   draft   → "draft"
     *   lunas   → "sent"
     *   cair    → "sent"  (giro_cair_date set separately)
     *   ditolak → "cancelled"
     *   bad_debt→ "cancelled"
     *   telat   → "sent"  (computed status will re-derive "telat" from due_date)
     *   proses  → "sent"  (computed status will re-derive "proses" from missing due_date)
     */
    updateStatus(id: string, status: PayStatus): void {
      const idx = documents.findIndex((d) => d.id === id);
      if (idx < 0) return;

      const doc = documents[idx];
      switch (status) {
        case "draft":
          doc.status = "draft";
          break;
        case "lunas":
        case "cair":
        case "telat":
        case "proses":
          doc.status = "sent";
          // For "cair" — set giro_cair_date if it's a giro/cek
          if (status === "cair" && !doc.giro_cair_date) {
            doc.giro_cair_date = new Date().toISOString().slice(0, 10);
          }
          break;
        case "ditolak":
        case "bad_debt":
          doc.status = "cancelled";
          break;
      }
    },

    /**
     * Given any document ID, check if a payment is linked to it and
     * return the payment's computed status + label + CSS class.
     * Useful for rendering a "payment badge" on PFI / Invoice rows.
     */
    getPaymentBadgeForDoc(
      docId: string,
    ): { status: PayStatus; label: string; cssClass: string } | null {
      const payment = documents.find(
        (d) => d.type === "payment" && d.parent_doc_id === docId && d.status !== "cancelled",
      );
      if (!payment) return null;

      const entry = buildPaymentEntry(payment);
      return { status: entry.status, label: entry.statusLabel, cssClass: `pay-badge--${entry.status}` };
    },
  };
}