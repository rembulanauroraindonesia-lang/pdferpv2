/**
 * $store.parties — CRUD store for master data Partai/Mitra.
 * Registered via Alpine.store("parties", partiesStore()) in main.ts.
 */
import { parties } from "@/data/parties";
import type { Party } from "@/types/schema";
import { savePartyToDB } from "@/lib/persist";

export interface PartiesStore {
  list: Party[];
  /** Currently editing party (null = add mode) */
  editing: Party | null;
  /** Modal open flag */
  modalOpen: boolean;
  /** Form draft fields */
  draft: { name: string; address: string; contact_person: string; contact_phone: string; bank_name: string; bank_account: string; bank_account_name: string };
  /** Open modal for ADD (null) or EDIT (pass existing party) */
  openModal(party: Party | null): void;
  closeModal(): void;
  save(): void;
  remove(id: string): void;
  toggleActive(id: string): void;
}

export function partiesStore(): PartiesStore {
  const empty = () => ({ name: "", address: "", contact_person: "", contact_phone: "", bank_name: "", bank_account: "", bank_account_name: "" });

  return {
    list: parties,
    editing: null,
    modalOpen: false,
    draft: empty(),

    openModal(party: Party | null) {
      this.editing = party;
      if (party) {
        this.draft = {
          name: party.name,
          address: party.address || "",
          contact_person: party.contact_person,
          contact_phone: party.contact_phone || "",
          bank_name: party.bank_name || "",
          bank_account: party.bank_account || "",
          bank_account_name: party.bank_account_name || "",
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

      let updatedParty: Party;

      if (this.editing) {
        // Update existing
        const idx = this.list.findIndex((p) => p.id === this.editing!.id);
        if (idx === -1) return;
        Object.assign(this.list[idx], {
          name: d.name.trim(),
          address: d.address.trim(),
          contact_person: d.contact_person.trim(),
          contact_phone: d.contact_phone.trim(),
          bank_name: d.bank_name.trim(),
          bank_account: d.bank_account.trim(),
          bank_account_name: d.bank_account_name.trim(),
        });
        updatedParty = this.list[idx];
      } else {
        // Add new
        const newId = "pa_new_" + Date.now();
        updatedParty = {
          id: newId,
          name: d.name.trim(),
          address: d.address.trim(),
          contact_person: d.contact_person.trim(),
          contact_phone: d.contact_phone.trim() || undefined,
          bank_name: d.bank_name.trim() || undefined,
          bank_account: d.bank_account.trim() || undefined,
          bank_account_name: d.bank_account_name.trim() || undefined,
          is_active: true,
        };
        this.list.push(updatedParty);
      }
      // Persist to PocketBase (fire-and-forget)
      savePartyToDB(updatedParty);
      this.closeModal();
    },

    remove(id: string) {
      const idx = this.list.findIndex((p) => p.id === id);
      if (idx !== -1) this.list.splice(idx, 1);
    },

    toggleActive(id: string) {
      const p = this.list.find((p) => p.id === id);
      if (p) p.is_active = !p.is_active;
    },
  };
}
