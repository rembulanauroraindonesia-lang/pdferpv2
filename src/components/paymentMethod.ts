/**
 * paymentMethod(doc) — reusable payment method component.
 * ---------------------------------------------------------------------------
 * Architecture:
 *   CASH  = Tunai / Transfer (immediate)
 *   CREDIT (X days) = Giro / Cek / Tempo (deferred)
 *
 * Usage:
 *   <div x-data="paymentMethod(doc)"> ... </div>
 *   <div x-data="paymentMethod($store.doc.currentDoc)"> ... </div>
 *
 * Exposes: paymentMode, netDays, paymentLabel, dueDateRef, deliveryDate,
 * invoiceDate, setPayment(), setNetDays(), setDueDateRef(), recalcDueDate(),
 * paymentOpen, togglePayment().
 */
import { formatDateID } from "@/lib/format";

export interface PaymentMethodComponent {
  // ── State (derived from doc) ──
  readonly paymentMode: "cash" | "nett";
  readonly netDays: number;
  readonly paymentLabel: string;
  readonly dueDateRef: "delivery" | "invoice";
  readonly deliveryDate: string;
  readonly invoiceDate: string;
  readonly dueDate: string;

  // ── Methods ──
  setPayment(mode: "cash" | "nett", days?: number): void;
  setNetDays(days: number): void;
  setDueDateRef(ref: "delivery" | "invoice"): void;
  recalcDueDate(): void;

  // ── UI helpers ──
  paymentOpen: boolean;
  togglePayment(): void;
  fmtDate(iso: string): string;
}

export function paymentMethod(docRef: Record<string, any> | null | undefined): PaymentMethodComponent {
  const d = () => docRef ?? {};

  return {
    // ── Derived state ──
    get paymentMode(): "cash" | "nett" {
      return (d().payment_method === "nett" ? "nett" : "cash");
    },
    get netDays(): number {
      return d().payment_net_days || 30;
    },
    get paymentLabel(): string {
      if (this.paymentMode === "cash") return "Cash";
      return `NETT ${this.netDays} Hari`;
    },
    get dueDateRef(): "delivery" | "invoice" {
      return d().due_date_ref || "delivery";
    },
    get deliveryDate(): string {
      return d().delivery_date || "";
    },
    get invoiceDate(): string {
      return d().invoice_received_date || "";
    },
    get dueDate(): string {
      return d().due_date || "";
    },

    // ── Methods ──
    setPayment(mode: "cash" | "nett", days?: number) {
      const doc = d();
      doc.payment_method = mode;
      if (mode === "nett" && days) {
        doc.payment_net_days = days;
        this.recalcDueDate();
      } else {
        doc.due_date = "";
        doc.payment_net_days = 0;
      }
    },

    setNetDays(days: number) {
      d().payment_net_days = days;
      this.recalcDueDate();
    },

    setDueDateRef(ref: "delivery" | "invoice") {
      d().due_date_ref = ref;
      this.recalcDueDate();
    },

    recalcDueDate() {
      const doc = d();
      if (this.paymentMode !== "nett" || !this.netDays) return;
      const refIso = this.dueDateRef === "delivery"
        ? doc.delivery_date
        : (doc.invoice_received_date || doc.date);
      if (!refIso) return;
      const ref = new Date(refIso);
      ref.setDate(ref.getDate() + this.netDays);
      doc.due_date = ref.toISOString().slice(0, 10);
    },

    // ── UI helpers ──
    paymentOpen: false,
    togglePayment() {
      this.paymentOpen = !this.paymentOpen;
    },
    fmtDate(iso: string): string {
      return formatDateID(iso);
    },
  };
}
