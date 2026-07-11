import { describe, it, expect } from "vitest";
import { LOCALE } from "@/lib/locale";

describe("LOCALE constants", () => {
  it('code is "id-ID"', () => {
    expect(LOCALE.code).toBe("id-ID");
  });

  it('currency is "IDR"', () => {
    expect(LOCALE.currency).toBe("IDR");
  });

  it('currencyPrefix is "Rp "', () => {
    expect(LOCALE.currencyPrefix).toBe("Rp ");
  });

  it('decimalSeparator is ","', () => {
    expect(LOCALE.decimalSeparator).toBe(",");
  });

  it('thousandsSeparator is "."', () => {
    expect(LOCALE.thousandsSeparator).toBe(".");
  });

  it("maxIntegerDigits is 12", () => {
    expect(LOCALE.maxIntegerDigits).toBe(12);
  });

  it("decimalPlaces is 2", () => {
    expect(LOCALE.decimalPlaces).toBe(2);
  });

  it("weekStartsOn is 1 (Monday)", () => {
    expect(LOCALE.weekStartsOn).toBe(1);
  });

  it("has 12 months in Bahasa Indonesia", () => {
    expect(LOCALE.months).toHaveLength(12);
    expect(LOCALE.months[0]).toBe("Januari");
    expect(LOCALE.months[11]).toBe("Desember");
  });

  it("months are the expected names", () => {
    const expected = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    expect([...LOCALE.months]).toEqual(expected);
  });

  it("has 7 short week days starting with Sn (Monday)", () => {
    expect(LOCALE.weekDaysShort).toHaveLength(7);
    expect(LOCALE.weekDaysShort[0]).toBe("Sn"); // Senin (Monday)
  });

  it("weekDaysShort are the expected values", () => {
    const expected = ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"];
    expect([...LOCALE.weekDaysShort]).toEqual(expected);
  });
});