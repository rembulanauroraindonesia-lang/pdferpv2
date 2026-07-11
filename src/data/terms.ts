import type { Term } from "@/types/schema";

/**
 * CALON COLLECTION: terms
 * ----------------------------------------------------------------------------
 * DB note: syarat & ketentuan per dokumen. seq = urutan tampil.
 */
const STANDARD_TERMS = [
  "Harga Franco, Nett, include PPN 11%.",
  "Pembayaran Cash before delivery",
  "Rekening BNI No. 8900011182 atas nama PT. REMBULAN AURORA INDONESIA.",
  "Harga & Stok tidak mengikat, Harga berlaku selama 3 hari dari tanggal penawaran.",
  "Pesanan terkonfirmasi tidak bisa di Cancel.",
];

const buildTerms = (docId: string, count = 5): Term[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `tm_${docId.slice(-3)}_${i + 1}`,
    document_id: docId,
    seq: i + 1,
    body: STANDARD_TERMS[i] ?? `Term ${i + 1}.`,
  }));

export const terms: Term[] = [
  ...buildTerms("doc_0001", 5),
  ...buildTerms("doc_0002", 5),
  ...buildTerms("doc_0003", 5),
  ...buildTerms("doc_0004", 5),
];

export const termsByDocument = (documentId: string): Term[] =>
  terms
    .filter((t) => t.document_id === documentId)
    .sort((a, b) => a.seq - b.seq);
