/**
 * $store.signatures — CRUD store for master data Signature/Tanda Tangan.
 * Registered via Alpine.store("signatures", signatureStore()) in main.ts.
 */
import { signatories } from "@/data/signatories";
import type { Signatory } from "@/types/schema";

export interface SignatureStore {
  list: Signatory[];
  editing: Signatory | null;
  modalOpen: boolean;
  draft: { name: string; role: string; signature_file: string };
  byRole(role: string): Signatory | undefined;
  openModal(sig: Signatory | null): void;
  closeModal(): void;
  save(): void;
  remove(id: string): void;
  toggleActive(id: string): void;
}

export function signatureStore(): SignatureStore {
  const empty = () => ({ name: "", role: "", signature_file: "" });

  return {
    list: signatories,
    editing: null,
    modalOpen: false,
    draft: empty(),

    byRole(role: string): Signatory | undefined {
      return this.list.find((s) => s.role === role && s.is_active);
    },

    openModal(sig: Signatory | null) {
      this.editing = sig;
      if (sig) {
        this.draft = {
          name: sig.name,
          role: sig.role,
          signature_file: sig.signature_file || "",
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
      if (!d.name.trim() || !d.role.trim()) return;

      if (this.editing) {
        const idx = this.list.findIndex((s) => s.id === this.editing!.id);
        if (idx === -1) return;
        Object.assign(this.list[idx], {
          name: d.name.trim(),
          role: d.role.trim(),
          signature_file: d.signature_file.trim() || undefined,
        });
      } else {
        const newId = "si_new_" + Date.now();
        this.list.push({
          id: newId,
          name: d.name.trim(),
          role: d.role.trim(),
          is_active: true,
          signature_file: d.signature_file.trim() || undefined,
        });
      }
      this.closeModal();
    },

    remove(id: string) {
      const idx = this.list.findIndex((s) => s.id === id);
      if (idx !== -1) this.list.splice(idx, 1);
    },

    toggleActive(id: string) {
      const s = this.list.find((s) => s.id === id);
      if (s) s.is_active = !s.is_active;
    },
  };
}
