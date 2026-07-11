import { describe, it, expect } from "vitest";
import { TYPE_PREFIX, COMPANY_CODE, nextDocNo, revisionLabel } from "@/lib/docNo";
import type { DocumentType } from "@/types/schema";

// ── TYPE_PREFIX ──────────────────────────────────────────────────────────────

describe("TYPE_PREFIX", () => {
  const expected: Record<DocumentType, string> = {
    quotation: "QTN",
    sales_order: "SO",
    proforma_invoice: "PFI",
    delivery: "SJ",
    pickup: "PM",
    invoice: "INV",
    po: "PO",
    payment: "PAY",
  };

  const types = Object.keys(expected) as DocumentType[];

  for (const type of types) {
    it(`TYPE_PREFIX["${type}"] === "${expected[type]}"`, () => {
      expect(TYPE_PREFIX[type]).toBe(expected[type]);
    });
  }

  it("has exactly 8 entries", () => {
    expect(Object.keys(TYPE_PREFIX)).toHaveLength(8);
  });
});

// ── nextDocNo ────────────────────────────────────────────────────────────────

describe("nextDocNo", () => {
  it("first document in a year → 0001", () => {
    const result = nextDocNo("quotation", 2026, []);
    expect(result).toBe("QTN/RAI/26/0001");
  });

  it("increments from existing documents", () => {
    const existing = [
      { doc_no: "QTN/RAI/26/0001", type: "quotation" as DocumentType },
      { doc_no: "QTN/RAI/26/0002", type: "quotation" as DocumentType },
    ];
    const result = nextDocNo("quotation", 2026, existing);
    expect(result).toBe("QTN/RAI/26/0003");
  });

  it("different types don't interfere", () => {
    const existing = [
      { doc_no: "QTN/RAI/26/0001", type: "quotation" as DocumentType },
      { doc_no: "QTN/RAI/26/0002", type: "quotation" as DocumentType },
      { doc_no: "INV/RAI/26/0001", type: "invoice" as DocumentType },
    ];
    // Quotation should be 0003, not affected by INV
    expect(nextDocNo("quotation", 2026, existing)).toBe("QTN/RAI/26/0003");
    // Invoice should be 0002
    expect(nextDocNo("invoice", 2026, existing)).toBe("INV/RAI/26/0002");
  });

  it("different years have separate sequences", () => {
    const existing = [
      { doc_no: "QTN/RAI/25/0005", type: "quotation" as DocumentType },
      { doc_no: "QTN/RAI/26/0001", type: "quotation" as DocumentType },
    ];
    expect(nextDocNo("quotation", 2025, existing)).toBe("QTN/RAI/25/0006");
    expect(nextDocNo("quotation", 2026, existing)).toBe("QTN/RAI/26/0002");
  });

  it("ignores documents from other types with same year", () => {
    const existing = [
      { doc_no: "PO/RAI/26/0001", type: "po" as DocumentType },
      { doc_no: "PO/RAI/26/0002", type: "po" as DocumentType },
    ];
    // Quotation should start fresh at 0001
    expect(nextDocNo("quotation", 2026, existing)).toBe("QTN/RAI/26/0001");
  });

  it("uses COMPANY_CODE correctly", () => {
    expect(COMPANY_CODE).toBe("RAI");
  });
});

// ── revisionLabel ────────────────────────────────────────────────────────────

describe("revisionLabel", () => {
  it('0 → ""', () => {
    expect(revisionLabel(0)).toBe("");
  });

  it('1 → "r1"', () => {
    expect(revisionLabel(1)).toBe("r1");
  });

  it('3 → "r3"', () => {
    expect(revisionLabel(3)).toBe("r3");
  });

  it('10 → "r10"', () => {
    expect(revisionLabel(10)).toBe("r10");
  });

  it("negative → empty string", () => {
    expect(revisionLabel(-1)).toBe("");
  });
});