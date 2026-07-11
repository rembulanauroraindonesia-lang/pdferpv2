/**
 * partyPicker() — searchable party selector + Quick Add (Alpine x-data factory).
 * ----------------------------------------------------------------------------
 * Usage in partial:
 *   <div x-data="partyPicker(party)" @pick-party="setParty($event.detail)">
 *
 * Behavior mirrors datePicker(): focus → open, click-outside → close.
 * On focus the name field clears so the user types to search; existing
 * matches show in a dropdown; "+ Quick Add" lets them create inline.
 */
import type { AlpineComponent } from "@/types/alpine";
import { parties, partyById } from "@/data/parties";

export interface PartyResult {
  id: string;
  name: string;
  address?: string;
  contact_person?: string;
  contact_phone?: string;
}

export type PartyPickerComponent = Partial<AlpineComponent> & {
  open: boolean;
  query: string;
  selectedId: string | undefined;
  showQuickAdd: boolean;
  qaName: string;
  qaAddress: string;
  qaContact: string;
  qaPhone: string;
  results: PartyResult[];
  buildResults(): void;
  focusField(): void;
  pick(id: string): void;
  openQuickAdd(): void;
  saveQuickAdd(): void;
  close(): void;
};

export function partyPicker(initial: { id?: string; name?: string } | undefined): PartyPickerComponent {
  const initialParty = initial?.id ? partyById(initial.id) : undefined;

  return {
    open: false,
    query: initialParty?.name || "",
    selectedId: initial?.id,
    showQuickAdd: false,
    qaName: "",
    qaAddress: "",
    qaContact: "",
    qaPhone: "",
    results: [],

    buildResults() {
      const q = this.query.trim().toLowerCase();
      const all: PartyResult[] = parties.map((p) => ({
        id: p.id, name: p.name, address: p.address,
        contact_person: p.contact_person, contact_phone: p.contact_phone,
      }));
      this.results = q
        ? all.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.contact_person || "").toLowerCase().includes(q),
          )
        : all;
    },
    focusField() {
      this.query = ""; // clear so user can search
      this.open = true;
      this.showQuickAdd = false;
      this.buildResults();
    },
    pick(id: string) {
      this.selectedId = id;
      const p = partyById(id);
      this.query = p?.name || "";
      this.open = false;
      this.$dispatch?.("pick-party", id);
    },
    openQuickAdd() {
      this.showQuickAdd = true;
      this.qaName = this.query; // pre-seed from current query
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
      this.showQuickAdd = false;
      this.pick(id);
    },
    close() {
      // restore displayed name if user didn't pick anything
      if (!this.selectedId) {
        this.open = false;
        return;
      }
      const p = partyById(this.selectedId);
      this.query = p?.name || "";
      this.open = false;
    },
  };
}
