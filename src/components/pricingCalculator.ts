/**
 * pricingCalculator() — modal popup for per-line pricing analysis (Alpine x-data).
 * ----------------------------------------------------------------------------
 * Usage in partial:
 *   <div x-data="pricingCalculator(line, idx)" ...>
 *     <button @click="open">Hitung Harga Satuan</button>
 *     <div class="modal" x-show="open">...</div>
 *   </div>
 *
 * Prefilled with the line's item_name + qty. Bidirectional pricing:
 * fill per-kg OR per-unit, the other derives via weight. Live margin.
 * On "Terapkan", the sell_per_unit feeds back into line.unit_price and
 * the full LinePricing record is stored on line.pricing.
 *
 * Note: Payment method is now document-level (Metode Pembayaran).
 * This calculator only deals with harga beli/jual per supplier.
 */
import type { AlpineComponent } from "@/types/alpine";
import type { LinePricing } from "@/types/schema";
import {
  derivePricing, onWeightChange, marginPerUnit, marginPct,
  toLinePricing, type PricingField, type PricingInput,
} from "@/lib/pricing";
import { parties } from "@/data/parties";

export type PricingCalculatorComponent = Partial<AlpineComponent> & {
  open: boolean;
  lineId: string;
  itemName: string;
  qty: number;
  // pricing mode: 'kg' = input per-kg, derive per-unit; 'unit' = reverse
  priceMode: "kg" | "unit";
  // supplier
  supplierQuery: string;
  supplierOpen: boolean;
  supplierResults: { id: string; name: string; contact_person?: string }[];
  selectedSupplierId: string | undefined;
  selectedSupplierName: string | undefined;
  // Quick Add (mirror partyPicker)
  showQuickAdd: boolean;
  qaName: string;
  qaAddress: string;
  qaContact: string;
  qaPhone: string;
  // pricing inputs
  buy_per_kg: number;
  buy_per_unit: number;
  sell_per_kg: number;
  sell_per_unit: number;
  buy_weight_per_unit: number;
  sell_weight_per_unit: number;
  // derived
  readonly marginUnit: number;
  readonly marginPctVal: number;
  readonly kgActive: boolean;
  readonly unitActive: boolean;
  // methods
  show(line: any): void;
  close(): void;
  setMode(mode: "kg" | "unit"): void;
  onPriceInput(field: PricingField): void;
  onWeightInput(which: "buy" | "sell"): void;
  focusSupplier(): void;
  filterSupplier(): void;
  pickSupplier(id: string): void;
  closeSupplier(): void;
  openQuickAdd(): void;
  saveQuickAdd(): void;
  apply(): void;
};

export function pricingCalculator(): PricingCalculatorComponent {
  return {
    open: false,
    lineId: "",
    itemName: "",
    qty: 0,
    priceMode: "kg",
    supplierQuery: "",
    supplierOpen: false,
    supplierResults: [],
    selectedSupplierId: undefined,
    selectedSupplierName: undefined,
    showQuickAdd: false,
    qaName: "",
    qaAddress: "",
    qaContact: "",
    qaPhone: "",
    buy_per_kg: 0,
    buy_per_unit: 0,
    sell_per_kg: 0,
    sell_per_unit: 0,
    buy_weight_per_unit: 0,
    sell_weight_per_unit: 0,

    get marginUnit(): number {
      return marginPerUnit(this as unknown as PricingInput);
    },
    get marginPctVal(): number {
      return marginPct(this as unknown as PricingInput);
    },
    get kgActive(): boolean { return this.priceMode === "kg"; },
    get unitActive(): boolean { return this.priceMode === "unit"; },

    show(line: any) {
      this.lineId = line.id;
      this.itemName = line.item_name || "";
      this.qty = line.qty || 0;
      this.showQuickAdd = false;
      this.qaName = ""; this.qaAddress = ""; this.qaContact = ""; this.qaPhone = "";
      const p = line.pricing as LinePricing | undefined;
      if (p) {
        this.buy_per_kg = p.buy_per_kg;
        this.buy_per_unit = p.buy_per_unit;
        this.sell_per_kg = p.sell_per_kg;
        this.sell_per_unit = p.sell_per_unit;
        this.buy_weight_per_unit = p.buy_weight_per_unit;
        this.sell_weight_per_unit = p.sell_weight_per_unit;
        this.selectedSupplierId = p.supplier_id;
        this.selectedSupplierName = p.supplier_name;
        this.supplierQuery = p.supplier_name || "";
      }
      this.open = true;
    },
    close() {
      this.open = false;
    },
    setMode(mode: "kg" | "unit") {
      this.priceMode = mode;
    },

    onPriceInput(field: PricingField) {
      const patch = derivePricing(this as unknown as PricingInput, field);
      Object.assign(this, patch);
    },
    onWeightInput(which: "buy" | "sell") {
      const patch = onWeightChange(this as unknown as PricingInput, which);
      Object.assign(this, patch);
    },

    focusSupplier() {
      this.supplierQuery = "";
      this.supplierOpen = true;
      this.filterSupplier();
    },
    filterSupplier() {
      const q = this.supplierQuery.trim().toLowerCase();
      this.supplierResults = (q
        ? parties.filter((p) =>
            p.name.toLowerCase().includes(q) ||
            (p.contact_person || "").toLowerCase().includes(q))
        : parties
      ).map((p) => ({ id: p.id, name: p.name, contact_person: p.contact_person }));
    },
    pickSupplier(id: string) {
      const p = parties.find((x) => x.id === id);
      this.selectedSupplierId = id;
      this.selectedSupplierName = p?.name;
      this.supplierQuery = p?.name || "";
      this.supplierOpen = false;
    },
    closeSupplier() {
      this.showQuickAdd = false;
      this.supplierOpen = false;
      if (this.selectedSupplierId) {
        const p = parties.find((x) => x.id === this.selectedSupplierId);
        this.supplierQuery = p?.name || "";
      }
    },
    openQuickAdd() {
      this.showQuickAdd = true;
      this.qaName = this.supplierQuery;
    },
    saveQuickAdd() {
      if (!this.qaName.trim()) return;
      const id = "pa_new_" + Date.now();
      parties.push({
        id,
        name: this.qaName.trim(),
        address: this.qaAddress.trim() || undefined,
        contact_person: this.qaContact.trim() || "",
        contact_phone: this.qaPhone.trim() || undefined,
        is_active: true,
      });
      this.qaName = ""; this.qaAddress = ""; this.qaContact = ""; this.qaPhone = "";
      this.showQuickAdd = false;
      this.pickSupplier(id);
    },

    apply() {
      const line = this.$el?.closest("[x-data^='docBody']") as HTMLElement | null;
      if (!line) return;
      const data = (line as any)._x_dataStack?.[0];
      if (!data) return;
      const targetLine = data.lines.find((l: any) => l.id === this.lineId);
      if (!targetLine) return;

      const lp = toLinePricing(
        this.lineId,
        this as unknown as PricingInput,
        { id: this.selectedSupplierId, name: this.selectedSupplierName },
      );
      targetLine.pricing = lp;
      targetLine.unit_price = this.sell_per_unit;
      this.close();
      this.$store?.doc.touch();
      this.$dispatch?.("pricing-applied", { lineId: this.lineId });
    },
  };
}
