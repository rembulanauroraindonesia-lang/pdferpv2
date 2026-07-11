/**
 * Formatting helpers — pure functions, no side effects.
 * Dipakai baik di Alpine (browser) maupun nanti di Hono BFF.
 */

const ID_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** 29450000 → "29.450.000" (Indonesian uses dot as thousands separator) */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("id-ID");
}

/** 29450000 → "Rp 29.450.000" */
export function formatRupiah(value: number): string {
  return `Rp ${formatNumber(value)}`;
}

/** Money with 2 decimals: 29450000 → "29.450.000,00" (Indonesian: . ribuan, , desimal). */
export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "0,00";
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Rupiah money with 2 decimals: 29450000 → "Rp 29.450.000,00". */
export function formatRupiahMoney(value: number): string {
  return `Rp ${formatMoney(value)}`;
}

/**
 * Parse a user-typed numeric string into a number.
 * Handles: "29.450.000" → 29450000, "12.500,50" → 12500.5, "0" → 0, "" → 0.
 * Indonesian format: dot = thousands, comma = decimal.
 */
export function parseMoneyInput(text: string): number {
  if (!text || text.trim() === "") return 0;
  // remove all dots (thousands sep), replace comma with dot (decimal)
  const cleaned = text.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** "2026-05-11" → "11 Mei 2026" */
export function formatDateID(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${d.getDate()} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Status → label + warna badge (matching tokens di tokens.css) */
export function statusMeta(status: string): { label: string; tone: string } {
  const map: Record<string, { label: string; tone: string }> = {
    draft: { label: "Draft", tone: "neutral" },
    sent: { label: "Terkirim", tone: "info" },
    confirmed: { label: "Dikonfirmasi", tone: "success" },
    invoiced: { label: "Difakturkan", tone: "info" },
    paid: { label: "Lunas", tone: "success" },
    cancelled: { label: "Batal", tone: "danger" },
  };
  return map[status] ?? { label: status, tone: "neutral" };
}
