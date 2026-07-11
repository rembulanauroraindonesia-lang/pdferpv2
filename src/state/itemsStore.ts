/**
 * $store.items — CRUD store for master data Item/Katalog.
 * Registered via Alpine.store("items", itemsStore()) in main.ts.
 */
import { items } from "@/data/items";
import type { Item } from "@/types/schema";

export interface ItemsStore {
  list: Item[];
  /** Currently editing item (null = add mode) */
  editing: Item | null;
  /** Modal open flag */
  modalOpen: boolean;
  /** Search filter */
  search: string;
  /** Form draft fields */
  draft: { code: string; name: string; category: string; unit: string; description: string };
  /** Computed: filtered list */
  get filtered(): Item[];
  /** Open modal for ADD (null) or EDIT (pass existing item) */
  openModal(item: Item | null): void;
  closeModal(): void;
  save(): void;
  remove(id: string): void;
}

export function itemsStore(): ItemsStore {
  const empty = () => ({ code: "", name: "", category: "", unit: "", description: "" });

  return {
    list: items,
    editing: null,
    modalOpen: false,
    search: "",
    draft: empty(),

    get filtered() {
      const q = this.search.toLowerCase().trim();
      if (!q) return this.list;
      return this.list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.code || "").toLowerCase().includes(q) ||
          (i.category || "").toLowerCase().includes(q),
      );
    },

    openModal(item: Item | null) {
      this.editing = item;
      if (item) {
        this.draft = {
          code: item.code || "",
          name: item.name,
          category: item.category || "",
          unit: item.unit,
          description: "",
        };
      } else {
        this.draft = empty();
      }
      this.modalOpen = true;
    },

    closeModal() {
      this.modalOpen = false;
      this.editing = null;
    },

    save() {
      const d = this.draft;
      if (!d.name.trim()) return;

      if (this.editing) {
        // Update existing
        const idx = this.list.findIndex((i) => i.id === this.editing!.id);
        if (idx === -1) return;
        Object.assign(this.list[idx], {
          code: d.code.trim() || undefined,
          name: d.name.trim(),
          category: d.category.trim() || undefined,
          unit: d.unit.trim(),
        });
      } else {
        // Add new
        const newId = "it_new_" + Date.now();
        this.list.push({
          id: newId,
          code: d.code.trim() || undefined,
          name: d.name.trim(),
          category: d.category.trim() || undefined,
          unit: d.unit.trim(),
        });
      }
      this.closeModal();
    },

    remove(id: string) {
      const idx = this.list.findIndex((i) => i.id === id);
      if (idx !== -1) this.list.splice(idx, 1);
    },
  };
}