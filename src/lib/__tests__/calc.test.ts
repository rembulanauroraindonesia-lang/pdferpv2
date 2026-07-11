import { describe, it, expect } from "vitest";
import { lineTotal, subtotal, calcTotals } from "@/lib/calc";
import type { DocumentLine } from "@/types/schema";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLine(qty: number, unitPrice: number): DocumentLine {
  return {
    id: "line_1",
    document_id: "doc_1",
    line_no: 1,
    item_name: "Test Item",
    qty,
    unit_price: unitPrice,
    unit: "Pcs",
  };
}

// ── lineTotal ────────────────────────────────────────────────────────────────

describe("lineTotal", () => {
  it("multiplies qty by unit_price", () => {
    expect(lineTotal(makeLine(100, 29450000))).toBe(2_945_000_000);
  });

  it("returns 0 when qty is 0", () => {
    expect(lineTotal(makeLine(0, 29450000))).toBe(0);
  });

  it("returns 0 when unit_price is 0", () => {
    expect(lineTotal(makeLine(100, 0))).toBe(0);
  });

  it("handles decimal values", () => {
    expect(lineTotal(makeLine(2.5, 1000))).toBe(2500);
  });

  it("handles negative values (edge case)", () => {
    expect(lineTotal(makeLine(-1, 1000))).toBe(-1000);
  });
});

// ── subtotal ─────────────────────────────────────────────────────────────────

describe("subtotal", () => {
  it("returns 0 for empty array", () => {
    expect(subtotal([])).toBe(0);
  });

  it("returns lineTotal for a single line", () => {
    const lines = [makeLine(100, 29450000)];
    expect(subtotal(lines)).toBe(2_945_000_000);
  });

  it("sums multiple lines", () => {
    const lines = [
      makeLine(100, 29450000), // 2,945,000,000
      makeLine(50, 10000000),  //   500,000,000
      makeLine(10, 500000),    //     5,000,000
    ];
    expect(subtotal(lines)).toBe(3_450_000_000);
  });
});

// ── calcTotals ───────────────────────────────────────────────────────────────

describe("calcTotals (ppnIncluded=true, include mode)", () => {
  const lines = [makeLine(100, 1_110_000)]; // grandTotal = 111,000,000

  it("subtotal equals grandTotal (gross display)", () => {
    const t = calcTotals(lines, 0.11, true);
    expect(t.subtotal).toBe(t.grandTotal);
  });

  it("extracts ppnAmount from gross", () => {
    const t = calcTotals(lines, 0.11, true);
    // ppnAmount = grandTotal - grandTotal/(1+0.11) = grandTotal * 0.11/1.11
    const expected = 111_000_000 * (0.11 / 1.11);
    expect(t.ppnAmount).toBeCloseTo(expected, 6);
  });

  it("ppnIncluded flag is true", () => {
    const t = calcTotals(lines, 0.11, true);
    expect(t.ppnIncluded).toBe(true);
  });
});

describe("calcTotals (ppnIncluded=false, exclude mode)", () => {
  const lines = [makeLine(100, 1_110_000)]; // grandTotal = 111,000,000

  it("subtotal is the base (before PPN)", () => {
    const t = calcTotals(lines, 0.11, false);
    const expectedBase = 111_000_000 / 1.11;
    expect(t.subtotal).toBeCloseTo(expectedBase, 8);
  });

  it("ppn is added to reach grandTotal", () => {
    const t = calcTotals(lines, 0.11, false);
    expect(t.subtotal + t.ppnAmount).toBeCloseTo(t.grandTotal, 8);
  });

  it("ppnIncluded flag is false", () => {
    const t = calcTotals(lines, 0.11, false);
    expect(t.ppnIncluded).toBe(false);
  });
});

describe("calcTotals mode-invariant: both modes produce the SAME grandTotal", () => {
  const lines = [
    makeLine(100, 1_110_000),
    makeLine(50, 555_000),
  ];
  const totalSum = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);

  it("include mode grandTotal = sum of lines", () => {
    const t = calcTotals(lines, 0.11, true);
    expect(t.grandTotal).toBe(totalSum);
  });

  it("exclude mode grandTotal = sum of lines (same as include)", () => {
    const t = calcTotals(lines, 0.11, false);
    expect(t.grandTotal).toBe(totalSum);
  });

  it("both modes have identical grandTotal", () => {
    const inc = calcTotals(lines, 0.11, true);
    const exc = calcTotals(lines, 0.11, false);
    expect(inc.grandTotal).toBe(exc.grandTotal);
  });
});

describe("calcTotals with custom ppnRate", () => {
  const lines = [makeLine(10, 1_210_000)]; // grandTotal = 12,100,000

  it("uses ppnRate=0.10 correctly", () => {
    const t = calcTotals(lines, 0.10, true);
    expect(t.ppnRate).toBe(0.10);
    expect(t.ppnAmount).toBeCloseTo(12_100_000 * (0.10 / 1.10), 8);
    expect(t.grandTotal).toBe(12_100_000);
  });

  it("uses ppnRate=0 (no tax)", () => {
    const t = calcTotals(lines, 0, true);
    expect(t.ppnRate).toBe(0);
    expect(t.ppnAmount).toBe(0);
    expect(t.grandTotal).toBe(12_100_000);
    expect(t.subtotal).toBe(12_100_000);
  });
});

describe("calcTotals edge cases", () => {
  it("empty lines → all zeros", () => {
    const t = calcTotals([], 0.11, true);
    expect(t.subtotal).toBe(0);
    expect(t.ppnAmount).toBe(0);
    expect(t.grandTotal).toBe(0);
  });

  it("empty lines exclude mode → all zeros", () => {
    const t = calcTotals([], 0.11, false);
    expect(t.subtotal).toBe(0);
    expect(t.ppnAmount).toBe(0);
    expect(t.grandTotal).toBe(0);
  });

  it("single line with large numbers", () => {
    const lines = [makeLine(1, 999_999_999_999)];
    const t = calcTotals(lines, 0.11, true);
    expect(t.grandTotal).toBe(999_999_999_999);
  });

  it("single line exclude mode with large numbers", () => {
    const lines = [makeLine(1, 999_999_999_999)];
    const t = calcTotals(lines, 0.11, false);
    expect(t.grandTotal).toBe(999_999_999_999);
  });
});