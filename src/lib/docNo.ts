/**
 * Document numbering — global format across all document types.
 * ----------------------------------------------------------------------------
 * Format: <PREFIX>/RAI/<YY>/<000X>
 *   PREFIX  — per document type, e.g. QTN (quotation), INV (invoice),
 *             PO (purchase order), PAY (payment)
 *   RAI     — company code (PT Rembulan Aurora Indonesia) — fixed
 *   YY      — 2-digit year of the doc date
 *   000X    — auto-increment sequence within (type, year), 4-digit zero-padded,
 *             placed LAST so the revision suffix attaches to the document
 *             identity, not the year. e.g. QTN/RAI/26/0001r1
 *
 * Revision suffix (lowercase, attaches to the sequence):
 *   base doc → no suffix
 *   revisi 1 → r1, revisi 2 → r2, revisi 3 → r3
 *
 * The base doc_no NEVER changes on revision; the revision lives in
 * `revision_count` and is rendered inline after the sequence in the UI.
 */

import type { DocumentType } from "@/types/schema";

export const COMPANY_CODE = "RAI";

export const TYPE_PREFIX: Record<DocumentType, string> = {
  quotation: "QTN",
  sales_order: "SO",
  proforma_invoice: "PFI",
  delivery: "SJ",
  pickup: "PM",
  invoice: "INV",
  po: "PO",
  payment: "PAY",
};

/**
 * Generate the next doc_no for a given type & year.
 * Looks at existing documents to find the max sequence and increments.
 */
export function nextDocNo(
  type: DocumentType,
  year: number,
  existing: { doc_no: string; type: DocumentType }[],
): string {
  const prefix = TYPE_PREFIX[type];
  const yy = String(year).slice(-2);
  const re = new RegExp(`^${prefix}/${COMPANY_CODE}/${yy}/(\\d{4})$`);
  let max = 0;
  for (const d of existing) {
    if (d.type !== type) continue;
    const m = d.doc_no.match(re);
    if (m) {
      const seq = Number(m[1]);
      if (seq > max) max = seq;
    }
  }
  const seq = String(max + 1).padStart(4, "0");
  return `${prefix}/${COMPANY_CODE}/${yy}/${seq}`;
}

/** Revision badge label: "" for base, "r1"/"r2"/"r3" for revisions. */
export function revisionLabel(revisionCount: number): string {
  return revisionCount > 0 ? `r${revisionCount}` : "";
}
