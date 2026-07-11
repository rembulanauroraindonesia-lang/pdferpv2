import type { DocumentLine } from "@/types/schema";

/**
 * Calculation helpers — pure functions untuk derived values.
 * ----------------------------------------------------------------------------
 * PRINSIP: subtotal / ppn / grand_total TIDAK disimpan di DB.
 * Selalu dihitung dari document_lines. Alasan: sumber kebenaran tunggal,
 * tidak mungkin inkonsistensi data.
 *
 * Untuk quotation ini: PPN sudah include di harga (nett).
 * Field `ppnIncluded` mengontrol apakah harga sudah termasuk PPN (true)
 * atau ditambahkan di atas subtotal (false).
 */

export interface DocTotals {
  subtotal: number; // sum of (qty * unit_price)
  ppnRate: number; // 0.11
  ppnIncluded: boolean; // true → harga sudah termasuk PPN (nett)
  ppnAmount: number; // nominal PPN (derived)
  grandTotal: number; // subtotal + ppnAmount (jika tidak include) atau = subtotal
}

/** Hitung total satu baris. */
export function lineTotal(line: Pick<DocumentLine, "qty" | "unit_price">): number {
  return line.qty * line.unit_price;
}

/** Hitung subtotal dari kumpulan baris. */
export function subtotal(lines: DocumentLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

/**
 * Hitung total dokumen lengkap.
 *
 * KONVENSI DATA: `unit_price` di document_lines SELALU harga INCLUDE
 * (harga final yang dibayar customer, sudah termasuk PPN). Flag
 * `ppnIncluded` adalah DISPLAY MODE, bukan data field:
 *   - true  → tampilkan harga include. Subtotal = gross (= grand).
 *   - false → tampilkan harga exclude. Subtotal = base. PPN ditambah.
 *             grandTotal tetap sama (= Σ(qty × unit_price)).
 * Dengan konvensi ini, switching mode tidak merusak data — customer
 * selalu membayar jumlah yang sama; hanya cara memecahnya yang beda.
 *
 * @param lines       baris-baris item (INCLUDE prices)
 * @param ppnRate     tarif PPN (default 0.11 = 11%)
 * @param ppnIncluded true → tampil include; false → tampil exclude
 */
export function calcTotals(
  lines: DocumentLine[],
  ppnRate = 0.11,
  ppnIncluded = true,
): DocTotals {
  // grandTotal is mode-invariant: it's the actual amount the customer
  // pays, computed from the canonical (include) unit prices.
  const grandTotal = subtotal(lines);

  if (ppnIncluded) {
    // Show gross. PPN is extracted for transparency (it's already
    // inside the gross number).
    const baseSubtotal = grandTotal / (1 + ppnRate);
    const ppnAmount = grandTotal - baseSubtotal;
    return {
      subtotal: grandTotal,
      ppnRate,
      ppnIncluded: true,
      ppnAmount,
      grandTotal,
    };
  }

  // Exclude mode: show base subtotal. PPN is added back to grand total.
  const baseSubtotal = grandTotal / (1 + ppnRate);
  const ppnAmount = grandTotal - baseSubtotal; // = baseSubtotal × ppnRate
  return {
    subtotal: baseSubtotal,
    ppnRate,
    ppnIncluded: false,
    ppnAmount,
    grandTotal, // = baseSubtotal + ppnAmount
  };
}
