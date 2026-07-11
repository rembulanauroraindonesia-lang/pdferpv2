import type { Term } from "@/types/schema";

/**
 * CALON COLLECTION: terms
 * ----------------------------------------------------------------------------
 * DB note: syarat & ketentuan per dokumen. seq = urutan tampil.
 */

// ── Per-type term sets ────────────────────────────────────────────────────────
const QUOTATION_TERMS = [
  "Harga Franco, Nett, include PPN 11%.",
  "Pembayaran Cash before delivery",
  "Rekening BNI No. 8900011182 atas nama PT. REMBULAN AURORA INDONESIA.",
  "Harga & Stok tidak mengikat, Harga berlaku selama 3 hari dari tanggal penawaran.",
  "Pesanan terkonfirmasi tidak bisa di Cancel.",
];

const SO_TERMS = [
  "Pesanan berdasarkan Penawaran yang telah disetujui.",
  "Harga Franco, Nett, include PPN 11%.",
  "Pembayaran sesuai ketentuan yang disepakati.",
  "Pengiriman sesuai jadwal yang telah ditentukan.",
  "Pesanan terkonfirmasi tidak bisa di Cancel.",
];

const PFI_TERMS = [
  "Berdasarkan Sales Order yang telah disepakati.",
  "Harga include PPN 11%.",
  "Pembayaran sesuai terms yang tertera.",
  "Barang dikirim sesuai jadwal pengiriman.",
  "Keterlambatan pembayaran dikenakan denda sesuai perjanjian.",
];

const DELIVERY_TERMS = [
  "Barang telah diperiksa dan dikemas dengan baik.",
  "Penerima wajib memeriksa barang saat serah terima.",
  "Klaim kerusakan harus diajukan maksimal 3 hari setelah penerimaan.",
  "Resiko pengiriman ditanggung penerima setelah barang diterima.",
];

const PO_TERMS = [
  "Pemesanan sesuai spesifikasi dan harga yang disepakati.",
  "Pengiriman sesuai jadwal yang telah disetujui.",
  "Pembayaran sesuai terms yang tertera.",
  "Barang yang diterima harus sesuai spesifikasi PO.",
  "Keterlambatan pengiriman dikenakan denda sesuai perjanjian.",
];

const INVOICE_TERMS = [
  "Tagihan sesuai dengan barang yang telah dikirim/diterima.",
  "Pembayaran harus diterima sebelum jatuh tempo.",
  "Keterlambatan pembayaran dikenakan denda 1% per bulan.",
  "Rekening pembayaran: BNI No. 8900011182 a/n PT. REMBULAN AURORA INDONESIA.",
];

const PAYMENT_TERMS = [
  "Pembayaran telah dilakukan sesuai tagihan.",
  "Bukti pembayaran ini sebagai tanda terima yang sah.",
  "Verifikasi pembayaran dilakukan oleh bagian Keuangan.",
];

const PICKUP_TERMS = [
  "Barang harus diambil sesuai jadwal yang telah disepakati.",
  "Pengambilan wajib membawa dokumen ini.",
  "Barang yang belum diambil setelah jadwal akan dikenakan biaya simpan.",
  "Penerima wajib memeriksa barang saat pengambilan.",
];

// ── Builder ───────────────────────────────────────────────────────────────────
const buildTerms = (docId: string, termBodies: string[]): Term[] =>
  termBodies.map((body, i) => ({
    id: `tm_${docId.slice(-6)}_${i + 1}`,
    document_id: docId,
    seq: i + 1,
    body,
  }));

// ── All document IDs from seed data, grouped by type ─────────────────────────
export const terms: Term[] = [
  // Quotations
  ...buildTerms("doc_0001", QUOTATION_TERMS),
  ...buildTerms("doc_0002", QUOTATION_TERMS),
  ...buildTerms("doc_0003", QUOTATION_TERMS),
  ...buildTerms("doc_0004", QUOTATION_TERMS),
  ...buildTerms("doc_0010", QUOTATION_TERMS),

  // Sales Orders
  ...buildTerms("doc_so_0001", SO_TERMS),
  ...buildTerms("doc_so_0010", SO_TERMS),

  // Proforma Invoices
  ...buildTerms("doc_pfi_0001", PFI_TERMS),
  ...buildTerms("doc_pfi_0010", PFI_TERMS),
  ...buildTerms("doc_pfi_beli_0001", PO_TERMS),

  // Deliveries
  ...buildTerms("doc_do_0001", DELIVERY_TERMS),
  ...buildTerms("doc_do_0010", DELIVERY_TERMS),

  // Pickups
  ...buildTerms("doc_pm_0001", PICKUP_TERMS),

  // Invoices
  ...buildTerms("doc_inv_0001", INVOICE_TERMS),
  ...buildTerms("doc_inv_0010", INVOICE_TERMS),

  // Purchase Orders
  ...buildTerms("doc_po_0001", PO_TERMS),

  // Payments
  ...buildTerms("doc_pay_0001", PAYMENT_TERMS),
];

export const termsByDocument = (documentId: string): Term[] =>
  terms
    .filter((t) => t.document_id === documentId)
    .sort((a, b) => a.seq - b.seq);