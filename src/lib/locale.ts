/**
 * LOCALE — Indonesian
 * ----------------------------------------------------------------------------
 * App-wide locale config. All formatting, currency, dates, numbers follow this.
 *
 * Conventions:
 *   - Language: Bahasa Indonesia
 *   - Currency: Rupiah (Rp), prefix "Rp "
 *   - Numbers: dot "." thousands separator, comma "," decimal
 *     e.g. 1.234.567.890,12 (hingga 12 digit sebelum koma)
 *   - Decimals: 2 digit di belakang koma (koma sebagai decimal separator)
 *   - Dates: "11 Mei 2026" (d [spasi] nama bulan [spasi] yyyy)
 *   - Week starts Monday
 */
export const LOCALE = {
  code: "id-ID",
  currency: "IDR",
  currencyPrefix: "Rp ",
  decimalSeparator: ",",
  thousandsSeparator: ".",
  maxIntegerDigits: 12, // supports up to Rp 999.999.999.999
  decimalPlaces: 2,
  weekStartsOn: 1, // Monday
  months: [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ],
  weekDaysShort: ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"],
} as const;
