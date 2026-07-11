/**
 * $store.deal — Deal Tracker dashboard store.
 * ----------------------------------------------------------------------------
 * Derived read-only view. No new collections. Deals are computed from existing
 * `documents[]` where type === 'sales_order' AND status === 'sent'.
 *
 * Each deal tracks two chains:
 *   Chain Jual: SO → PFI (jual) → Delivery (jual) → Invoice (jual)
 *   Chain Beli: PO (beli) → PFI (beli) → Delivery (beli) → Invoice (beli)
 *
 * HPP and margin are computed from SO line pricings.
 */
import { documents } from "@/data/documents";
import { linesByDocument } from "@/data/documentLines";
import { partyById } from "@/data/parties";
import { staffById } from "@/data/staff";
import { formatNumber, formatDateID } from "@/lib/format";
import type { Document } from "@/types/schema";

export interface ChainStep {
  type: string;
  label: string;
  status: "done" | "draft" | "absent";
  docNo: string;
}

export interface Deal {
  soId: string;
  soNo: string;
  customerName: string;
  date: string;
  dateLabel: string;
  marketingName: string;
  nilaiDeal: number;
  nilaiDealLabel: string;
  hpp: number;
  hppLabel: string;
  margin: number;
  marginLabel: string;
  marginPct: number;
  chainJual: ChainStep[];
  chainBeli: ChainStep[];
  paymentStatus: "lunas" | "sebagian" | "proses" | "belum";
  paymentLabel: string;
}

export interface DealStore {
  readonly deals: Deal[];
  fmtNum(n: number): string;
}

export function dealStore(): DealStore {
  return {
    get deals(): Deal[] {
      const sos = documents.filter(
        (d) => d.type === "sales_order" && d.status === "sent",
      );
      return sos.map((so) => buildDeal(so));
    },
    fmtNum(n: number): string {
      return formatNumber(n);
    },
  };
}

function buildDeal(so: Document): Deal {
  const party = so.party_id ? partyById(so.party_id) : undefined;
  const marketing = so.marketing_staff_id
    ? staffById(so.marketing_staff_id)
    : undefined;

  // Lines + financials
  const lines = linesByDocument(so.id);
  const nilaiDeal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const hpp = lines.reduce((s, l) => {
    if (l.pricing) return s + l.pricing.buy_per_unit * l.qty;
    return s;
  }, 0);
  const margin = nilaiDeal - hpp;
  const marginPct = hpp > 0 ? (margin / hpp) * 100 : 0;

  // Chain Jual: SO → PFI (jual) → Delivery (jual) → Invoice (jual)
  const chainJual = buildChainJual(so);

  // Chain Beli: PO (beli) → PFI (beli) → Delivery (beli) → Invoice (beli)
  const chainBeli = buildChainBeli();

  // Payment status: check if payment docs exist linked to this deal's chain.
  // Walk the Jual chain to find an invoice, then look for payment docs.
  const invoiceJual = chainJual.find((s) => s.type === "invoice" && s.status !== "absent");
  const paymentStatus = resolvePaymentStatus(so.id, invoiceJual?.docNo);

  return {
    soId: so.id,
    soNo: so.doc_no,
    customerName: party?.name ?? "—",
    date: so.date,
    dateLabel: formatDateID(so.date),
    marketingName: marketing?.name ?? "—",
    nilaiDeal,
    nilaiDealLabel: formatNumber(nilaiDeal),
    hpp,
    hppLabel: formatNumber(hpp),
    margin,
    marginLabel: formatNumber(margin),
    marginPct,
    chainJual,
    chainBeli,
    paymentStatus: paymentStatus.status,
    paymentLabel: paymentStatus.label,
  };
}

function findChildDoc(
  parentId: string,
  type: string,
  direction: string,
): Document | undefined {
  return documents.find(
    (d) =>
      d.parent_doc_id === parentId &&
      d.type === type &&
      d.direction === direction,
  );
}

function stepFromDoc(
  type: string,
  label: string,
  doc: Document | undefined,
): ChainStep {
  if (!doc) return { type, label, status: "absent", docNo: "" };
  return {
    type,
    label,
    status: doc.status === "sent" ? "done" : "draft",
    docNo: doc.doc_no,
  };
}

function buildChainJual(so: Document): ChainStep[] {
  // Step 1: SO itself (always done — deal = locked SO)
  const soStep: ChainStep = {
    type: "sales_order",
    label: "SO",
    status: "done",
    docNo: so.doc_no,
  };

  // Step 2: PFI Jual (parent = SO)
  const pfi = findChildDoc(so.id, "proforma_invoice", "jual");

  // Step 3: Delivery Jual (parent = PFI if exists, else SO)
  const deliveryParent = pfi?.id ?? so.id;
  const delivery = findChildDoc(deliveryParent, "delivery", "jual");

  // Step 4: Invoice Jual (parent = Delivery if exists, else PFI, else SO)
  const invoiceParent = delivery?.id ?? pfi?.id ?? so.id;
  const invoice = findChildDoc(invoiceParent, "invoice", "jual");

  return [
    soStep,
    stepFromDoc("proforma_invoice", "PFI", pfi),
    stepFromDoc("delivery", "DEL", delivery),
    stepFromDoc("invoice", "INV", invoice),
  ];
}

function buildChainBeli(): ChainStep[] {
  // For mockup v1: check existence of any beli docs per type.
  // Future: match by supplier_id from SO line pricings or explicit parent_doc_id.

  const findBeli = (type: string): Document | undefined =>
    documents.find((d) => d.type === type && d.direction === "beli");

  const po = findBeli("po");
  const pfi = findBeli("proforma_invoice");
  const pickup = findBeli("pickup");
  const invoice = findBeli("invoice");

  return [
    stepFromDoc("po", "PO", po),
    stepFromDoc("proforma_invoice", "PFI", pfi),
    stepFromDoc("pickup", "PKP", pickup),
    stepFromDoc("invoice", "INV", invoice),
  ];
}

/**
 * Resolve payment status for a deal.
 * Walks the Jual chain to find linked payment documents.
 *   - No invoice yet → "belum" (Belum Ditagih)
 *   - Invoice exists, no payment doc → "belum" (Belum Bayar)
 *   - Payment doc exists, draft → "proses" (Proses)
 *   - Payment doc exists, sent → "lunas" (Lunas)
 *
 * For mockup v1: simple lookup by parent_doc_id chain.
 * Future: match by amount (partial payment → "sebagian").
 */
function resolvePaymentStatus(
  soId: string,
  _invoiceDocNo: string | undefined,
): { status: "lunas" | "sebagian" | "proses" | "belum"; label: string } {
  // Find any payment doc linked to the SO or its chain children.
  // Walk: SO → PFI → Delivery → Invoice → Payment
  const pfi = findChildDoc(soId, "proforma_invoice", "jual");
  const delivery = pfi
    ? findChildDoc(pfi.id, "delivery", "jual")
    : findChildDoc(soId, "delivery", "jual");
  const invoice = delivery
    ? findChildDoc(delivery.id, "invoice", "jual")
    : pfi
      ? findChildDoc(pfi.id, "invoice", "jual")
      : findChildDoc(soId, "invoice", "jual");

  // No invoice yet — not yet billable.
  if (!invoice) {
    return { status: "belum", label: "Belum Ditagih" };
  }

  // Check if a payment doc exists linked to the invoice.
  const payment = documents.find(
    (d) => d.type === "payment" && d.direction === "jual" && d.parent_doc_id === invoice.id,
  );

  if (!payment) {
    return { status: "belum", label: "Belum Bayar" };
  }
  if (payment.status === "sent") {
    return { status: "lunas", label: "Lunas" };
  }
  return { status: "proses", label: "Proses" };
}