/**
 * Pricing calculations — bidirectional per-kg ↔ per-unit via weight.
 * ----------------------------------------------------------------------------
 * The user can fill EITHER per-kg OR per-unit; the other derives from weight:
 *   per_unit = per_kg × weight_per_unit
 *   per_kg   = per_unit ÷ weight_per_unit
 *
 * Same rule applies to both buy and sell sides.
 * Weight is the bridge. If weight is 0, derivation is undefined → leave the
 * other field as-is (user must enter weight first).
 */
import type { LinePricing } from "@/types/schema";

export interface PricingInput {
  buy_per_kg: number;
  buy_per_unit: number;
  sell_per_kg: number;
  sell_per_unit: number;
  buy_weight_per_unit: number;
  sell_weight_per_unit: number;
}

/** Which field the user last edited (drives the derivation direction). */
export type PricingField =
  | "buy_per_kg" | "buy_per_unit"
  | "sell_per_kg" | "sell_per_unit";

/**
 * Recompute the derived field based on which input changed.
 * Returns a patch object with the updated values.
 */
export function derivePricing(
  current: PricingInput,
  changedField: PricingField,
): Partial<PricingInput> {
  const patch: Partial<PricingInput> = {};

  if (changedField === "buy_per_kg") {
    // derive buy_per_unit = buy_per_kg × buy_weight
    if (current.buy_weight_per_unit > 0) {
      patch.buy_per_unit = round2(current.buy_per_kg * current.buy_weight_per_unit);
    }
  } else if (changedField === "buy_per_unit") {
    // derive buy_per_kg = buy_per_unit ÷ buy_weight
    if (current.buy_weight_per_unit > 0) {
      patch.buy_per_kg = round2(current.buy_per_unit / current.buy_weight_per_unit);
    }
  } else if (changedField === "sell_per_kg") {
    if (current.sell_weight_per_unit > 0) {
      patch.sell_per_unit = round2(current.sell_per_kg * current.sell_weight_per_unit);
    }
  } else if (changedField === "sell_per_unit") {
    if (current.sell_weight_per_unit > 0) {
      patch.sell_per_kg = round2(current.sell_per_unit / current.sell_weight_per_unit);
    }
  }

  return patch;
}

/**
 * When weight changes, re-derive the missing counterpart.
 * If per_kg is set → derive per_unit = per_kg × weight.
 * If per_kg is 0 but per_unit is set → derive per_kg = per_unit ÷ weight.
 */
export function onWeightChange(
  current: PricingInput,
  which: "buy" | "sell",
): Partial<PricingInput> {
  const patch: Partial<PricingInput> = {};
  if (which === "buy" && current.buy_weight_per_unit > 0) {
    if (current.buy_per_kg > 0) {
      patch.buy_per_unit = round2(current.buy_per_kg * current.buy_weight_per_unit);
    } else if (current.buy_per_unit > 0) {
      patch.buy_per_kg = round2(current.buy_per_unit / current.buy_weight_per_unit);
    }
  }
  if (which === "sell" && current.sell_weight_per_unit > 0) {
    if (current.sell_per_kg > 0) {
      patch.sell_per_unit = round2(current.sell_per_kg * current.sell_weight_per_unit);
    } else if (current.sell_per_unit > 0) {
      patch.sell_per_kg = round2(current.sell_per_unit / current.sell_weight_per_unit);
    }
  }
  return patch;
}

/** Margin per unit (sell − buy). */
export function marginPerUnit(p: PricingInput): number {
  return round2(p.sell_per_unit - p.buy_per_unit);
}

/** Margin percentage relative to buy price. */
export function marginPct(p: PricingInput): number {
  if (p.buy_per_unit === 0) return 0;
  return round2((marginPerUnit(p) / p.buy_per_unit) * 100);
}

/** Build a LinePricing record from the calculator input + line context. */
export function toLinePricing(
  lineId: string,
  input: PricingInput,
  supplier?: { id?: string; name?: string },
): LinePricing {
  return {
    id: "lp_" + Date.now(),
    line_id: lineId,
    supplier_id: supplier?.id,
    supplier_name: supplier?.name,
    buy_per_kg: input.buy_per_kg,
    buy_per_unit: input.buy_per_unit,
    sell_per_kg: input.sell_per_kg,
    sell_per_unit: input.sell_per_unit,
    buy_weight_per_unit: input.buy_weight_per_unit,
    sell_weight_per_unit: input.sell_weight_per_unit,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
