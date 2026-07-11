import type { Signatory } from "@/types/schema";

/**
 * CALON COLLECTION: signatories
 * ----------------------------------------------------------------------------
 * DB note: orang yang tanda tangan di dokumen.
 * signature_file → field "file" di PocketBase.
 *
 * SIGNATURE PLACEMENT by document type:
 *   Penawaran     → Marketing
 *   Sales Order   → Marketing + Direktur
 *   Proforma Inv. → Finance + Direktur/Keuangan Customer
 *   Delivery      → Logistik
 *   Invoice       → Finance
 *   Purchase Order→ Purchasing + Direktur
 *   Pickup        → Logistik
 */
export const signatories: Signatory[] = [
  {
    id: "si_direktur",
    name: "Winarto.",
    role: "Direktur",
    is_active: true,
    signature_file: undefined,
  },
  {
    id: "si_marketing",
    name: "Ibu Tiara",
    role: "Marketing",
    is_active: true,
    signature_file: undefined,
  },
  {
    id: "si_purchasing",
    name: "Bpk. Hendra",
    role: "Purchasing",
    is_active: true,
    signature_file: undefined,
  },
  {
    id: "si_finance",
    name: "Ibu Ratna",
    role: "Finance",
    is_active: true,
    signature_file: undefined,
  },
  {
    id: "si_logistik",
    name: "Bpk. Agus",
    role: "Logistik",
    is_active: true,
    signature_file: undefined,
  },
];

export const signatoryById = (id: string): Signatory | undefined =>
  signatories.find((s) => s.id === id);

export const signatoryByRole = (role: string): Signatory | undefined =>
  signatories.find((s) => s.role === role && s.is_active);
