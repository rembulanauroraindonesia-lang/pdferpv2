/**
 * Marketing staff list — for the "Marketing" dropdown in Konfigurasi panel.
 * Mock data; will move to PocketBase `staff` collection later.
 */
export interface Staff {
  id: string;
  name: string;
}

export const staff: Staff[] = [
  { id: "st_andi", name: "Andi Wijaya" },
  { id: "st_siti", name: "Siti Rahayu" },
  { id: "st_budi", name: "Budi Santoso" },
  { id: "st_dewi", name: "Dewi Lestari" },
];

export const staffById = (id: string): Staff | undefined =>
  staff.find((s) => s.id === id);
