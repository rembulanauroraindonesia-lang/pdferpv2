import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatRupiah,
  formatMoney,
  formatRupiahMoney,
  parseMoneyInput,
  formatDateID,
  statusMeta,
} from "@/lib/format";

// ── formatNumber ─────────────────────────────────────────────────────────────

describe("formatNumber", () => {
  it("formats 0 as '0'", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats small numbers", () => {
    expect(formatNumber(1)).toBe("1");
    expect(formatNumber(999)).toBe("999");
  });

  it("formats large numbers with Indonesian thousands separator (dot)", () => {
    expect(formatNumber(29450000)).toBe("29.450.000");
  });

  it("formats very large numbers", () => {
    expect(formatNumber(1_234_567_890)).toBe("1.234.567.890");
  });

  it("handles negative numbers", () => {
    expect(formatNumber(-1500)).toBe("-1.500");
  });

  it("returns '0' for NaN", () => {
    expect(formatNumber(NaN)).toBe("0");
  });

  it("returns '0' for Infinity", () => {
    expect(formatNumber(Infinity)).toBe("0");
  });

  it("returns '0' for -Infinity", () => {
    expect(formatNumber(-Infinity)).toBe("0");
  });
});

// ── formatRupiah ─────────────────────────────────────────────────────────────

describe("formatRupiah", () => {
  it("formats with Rp prefix", () => {
    expect(formatRupiah(29450000)).toBe("Rp 29.450.000");
  });

  it("formats 0", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
  });
});

// ── formatMoney ──────────────────────────────────────────────────────────────

describe("formatMoney", () => {
  it("formats 0 with 2 decimals", () => {
    expect(formatMoney(0)).toBe("0,00");
  });

  it("formats with 2 decimal places", () => {
    expect(formatMoney(12500.5)).toBe("12.500,50");
  });

  it("formats large numbers", () => {
    expect(formatMoney(29450000)).toBe("29.450.000,00");
  });

  it("returns '0,00' for NaN", () => {
    expect(formatMoney(NaN)).toBe("0,00");
  });

  it("returns '0,00' for Infinity", () => {
    expect(formatMoney(Infinity)).toBe("0,00");
  });

  it("returns '0,00' for -Infinity", () => {
    expect(formatMoney(-Infinity)).toBe("0,00");
  });
});

// ── formatRupiahMoney ────────────────────────────────────────────────────────

describe("formatRupiahMoney", () => {
  it("formats with Rp prefix and 2 decimals", () => {
    expect(formatRupiahMoney(29450000)).toBe("Rp 29.450.000,00");
  });

  it("formats 0", () => {
    expect(formatRupiahMoney(0)).toBe("Rp 0,00");
  });
});

// ── parseMoneyInput ──────────────────────────────────────────────────────────

describe("parseMoneyInput", () => {
  it('empty string → 0', () => {
    expect(parseMoneyInput("")).toBe(0);
  });

  it('whitespace-only string → 0', () => {
    expect(parseMoneyInput("   ")).toBe(0);
  });

  it('"29.450.000" → 29450000', () => {
    expect(parseMoneyInput("29.450.000")).toBe(29450000);
  });

  it('"12.500,50" → 12500.5', () => {
    expect(parseMoneyInput("12.500,50")).toBe(12500.5);
  });

  it('"0" → 0', () => {
    expect(parseMoneyInput("0")).toBe(0);
  });

  it('"1.234.567.890,12" → 1234567890.12', () => {
    expect(parseMoneyInput("1.234.567.890,12")).toBe(1234567890.12);
  });

  it("handles trailing dots (e.g. '1.000.')", () => {
    // After removing dots: "1000" → 1000
    expect(parseMoneyInput("1.000.")).toBe(1000);
  });

  it("handles plain integer string", () => {
    expect(parseMoneyInput("5000")).toBe(5000);
  });

  it("handles string with only comma", () => {
    expect(parseMoneyInput(",50")).toBe(0.5);
  });
});

// ── formatDateID ─────────────────────────────────────────────────────────────

describe("formatDateID", () => {
  it("formats a valid ISO date", () => {
    expect(formatDateID("2026-05-11")).toBe("11 Mei 2026");
  });

  it("formats January correctly", () => {
    expect(formatDateID("2025-01-15")).toBe("15 Januari 2025");
  });

  it("formats December correctly", () => {
    expect(formatDateID("2025-12-31")).toBe("31 Desember 2025");
  });

  it("returns raw string for invalid date", () => {
    expect(formatDateID("not-a-date")).toBe("not-a-date");
  });

  it("handles single-digit day correctly (e.g. 2026-03-05)", () => {
    expect(formatDateID("2026-03-05")).toBe("5 Maret 2026");
  });
});

// ── statusMeta ───────────────────────────────────────────────────────────────

describe("statusMeta", () => {
  const known = [
    { status: "draft", label: "Draft", tone: "neutral" },
    { status: "sent", label: "Terkirim", tone: "info" },
    { status: "confirmed", label: "Dikonfirmasi", tone: "success" },
    { status: "invoiced", label: "Difakturkan", tone: "info" },
    { status: "paid", label: "Lunas", tone: "success" },
    { status: "cancelled", label: "Batal", tone: "danger" },
  ];

  for (const { status, label, tone } of known) {
    it(`status="${status}" → label="${label}", tone="${tone}"`, () => {
      const m = statusMeta(status);
      expect(m.label).toBe(label);
      expect(m.tone).toBe(tone);
    });
  }

  it("unknown status returns raw string as label with neutral tone", () => {
    const m = statusMeta("foobar");
    expect(m.label).toBe("foobar");
    expect(m.tone).toBe("neutral");
  });
});