import { describe, it, expect } from "vitest";
import {
  derivePricing,
  onWeightChange,
  marginPerUnit,
  marginPct,
  toLinePricing,
} from "@/lib/pricing";
import type { PricingInput } from "@/lib/pricing";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    buy_per_kg: 0,
    buy_per_unit: 0,
    sell_per_kg: 0,
    sell_per_unit: 0,
    buy_weight_per_unit: 0,
    sell_weight_per_unit: 0,
    ...overrides,
  };
}

// ── derivePricing ────────────────────────────────────────────────────────────

describe("derivePricing", () => {
  it("buy_per_kg → derives buy_per_unit when weight > 0", () => {
    const patch = derivePricing(
      makeInput({ buy_per_kg: 10000, buy_weight_per_unit: 2.5 }),
      "buy_per_kg",
    );
    expect(patch.buy_per_unit).toBe(25000); // 10000 * 2.5
  });

  it("buy_per_unit → derives buy_per_kg when weight > 0", () => {
    const patch = derivePricing(
      makeInput({ buy_per_unit: 25000, buy_weight_per_unit: 2.5 }),
      "buy_per_unit",
    );
    expect(patch.buy_per_kg).toBe(10000); // 25000 / 2.5
  });

  it("sell_per_kg → derives sell_per_unit when weight > 0", () => {
    const patch = derivePricing(
      makeInput({ sell_per_kg: 15000, sell_weight_per_unit: 2.5 }),
      "sell_per_kg",
    );
    expect(patch.sell_per_unit).toBe(37500);
  });

  it("sell_per_unit → derives sell_per_kg when weight > 0", () => {
    const patch = derivePricing(
      makeInput({ sell_per_unit: 37500, sell_weight_per_unit: 2.5 }),
      "sell_per_unit",
    );
    expect(patch.sell_per_kg).toBe(15000);
  });

  it("weight=0 → patch is empty (no derivation)", () => {
    const patch = derivePricing(
      makeInput({ buy_per_kg: 10000, buy_weight_per_unit: 0 }),
      "buy_per_kg",
    );
    expect(patch).toEqual({});
  });

  it("rounds to 2 decimal places", () => {
    const patch = derivePricing(
      makeInput({ buy_per_kg: 10000, buy_weight_per_unit: 3 }),
      "buy_per_kg",
    );
    expect(patch.buy_per_unit).toBe(30000);
  });
});

// ── onWeightChange ───────────────────────────────────────────────────────────

describe("onWeightChange", () => {
  it("buy: derives per_unit from per_kg when per_kg > 0", () => {
    const patch = onWeightChange(
      makeInput({ buy_per_kg: 10000, buy_weight_per_unit: 2 }),
      "buy",
    );
    expect(patch.buy_per_unit).toBe(20000);
  });

  it("buy: derives per_kg from per_unit when per_kg is 0 but per_unit > 0", () => {
    const patch = onWeightChange(
      makeInput({ buy_per_kg: 0, buy_per_unit: 20000, buy_weight_per_unit: 2 }),
      "buy",
    );
    expect(patch.buy_per_kg).toBe(10000);
  });

  it("sell: derives per_unit from per_kg when per_kg > 0", () => {
    const patch = onWeightChange(
      makeInput({ sell_per_kg: 15000, sell_weight_per_unit: 2 }),
      "sell",
    );
    expect(patch.sell_per_unit).toBe(30000);
  });

  it("sell: derives per_kg from per_unit when per_kg is 0 but per_unit > 0", () => {
    const patch = onWeightChange(
      makeInput({ sell_per_kg: 0, sell_per_unit: 30000, sell_weight_per_unit: 2 }),
      "sell",
    );
    expect(patch.sell_per_kg).toBe(15000);
  });

  it("weight=0 → returns empty patch", () => {
    const patch = onWeightChange(
      makeInput({ buy_per_kg: 10000, buy_weight_per_unit: 0 }),
      "buy",
    );
    expect(patch).toEqual({});
  });

  it("both prices 0 → returns empty patch", () => {
    const patch = onWeightChange(
      makeInput({ buy_per_kg: 0, buy_per_unit: 0, buy_weight_per_unit: 5 }),
      "buy",
    );
    expect(patch).toEqual({});
  });
});

// ── marginPerUnit ────────────────────────────────────────────────────────────

describe("marginPerUnit", () => {
  it("positive margin", () => {
    const p = makeInput({ buy_per_unit: 20000, sell_per_unit: 30000 });
    expect(marginPerUnit(p)).toBe(10000);
  });

  it("zero margin (buy == sell)", () => {
    const p = makeInput({ buy_per_unit: 20000, sell_per_unit: 20000 });
    expect(marginPerUnit(p)).toBe(0);
  });

  it("negative margin (loss)", () => {
    const p = makeInput({ buy_per_unit: 30000, sell_per_unit: 20000 });
    expect(marginPerUnit(p)).toBe(-10000);
  });
});

// ── marginPct ────────────────────────────────────────────────────────────────

describe("marginPct", () => {
  it("normal positive margin percentage", () => {
    const p = makeInput({ buy_per_unit: 20000, sell_per_unit: 30000 });
    // (10000 / 20000) * 100 = 50
    expect(marginPct(p)).toBe(50);
  });

  it("returns 0 when buy_per_unit is 0", () => {
    const p = makeInput({ buy_per_unit: 0, sell_per_unit: 30000 });
    expect(marginPct(p)).toBe(0);
  });

  it("negative margin percentage", () => {
    const p = makeInput({ buy_per_unit: 30000, sell_per_unit: 20000 });
    // (-10000 / 30000) * 100 = -33.33...
    expect(marginPct(p)).toBeCloseTo(-33.33, 1);
  });
});

// ── toLinePricing ────────────────────────────────────────────────────────────

describe("toLinePricing", () => {
  it("creates a LinePricing with all fields", () => {
    const input = makeInput({
      buy_per_kg: 10000,
      buy_per_unit: 25000,
      sell_per_kg: 15000,
      sell_per_unit: 37500,
      buy_weight_per_unit: 2.5,
      sell_weight_per_unit: 2.5,
    });
    const lp = toLinePricing("line_abc", input);
    expect(lp.line_id).toBe("line_abc");
    expect(lp.buy_per_kg).toBe(10000);
    expect(lp.buy_per_unit).toBe(25000);
    expect(lp.sell_per_kg).toBe(15000);
    expect(lp.sell_per_unit).toBe(37500);
    expect(lp.buy_weight_per_unit).toBe(2.5);
    expect(lp.sell_weight_per_unit).toBe(2.5);
    expect(lp.id).toMatch(/^lp_\d+$/);
  });

  it("with supplier", () => {
    const input = makeInput();
    const lp = toLinePricing("line_abc", input, { id: "sup_1", name: "PT Supplier" });
    expect(lp.supplier_id).toBe("sup_1");
    expect(lp.supplier_name).toBe("PT Supplier");
  });

  it("without supplier → undefined supplier fields", () => {
    const input = makeInput();
    const lp = toLinePricing("line_abc", input);
    expect(lp.supplier_id).toBeUndefined();
    expect(lp.supplier_name).toBeUndefined();
  });

  it("with partial supplier info", () => {
    const input = makeInput();
    const lp = toLinePricing("line_abc", input, { name: "Ad-hoc Supplier" });
    expect(lp.supplier_id).toBeUndefined();
    expect(lp.supplier_name).toBe("Ad-hoc Supplier");
  });
});