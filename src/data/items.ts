import type { Item } from "@/types/schema";

/**
 * CALON COLLECTION: items
 * ----------------------------------------------------------------------------
 * DB note: master katalog. Harga TIDAK di sini — di document_lines.
 */
export const items: Item[] = [
  {
    id: "it_plat_kapal_12nc",
    code: undefined,
    name: "Plat Kapal 12mm x 8' x 30' Non Class",
    category: "Plat Kapal",
    unit: "Pcs",
  },
  {
    id: "it_plat_kapal_10nc",
    code: undefined,
    name: "Plat Kapal 10mm x 8' x 30' Non Class",
    category: "Plat Kapal",
    unit: "Pcs",
  },
  {
    id: "it_plat_kapal_16bki",
    code: undefined,
    name: "Plat Kapal 16mm x 8' x 30' Class BKI",
    category: "Plat Kapal",
    unit: "Pcs",
  },
  {
    id: "it_besi_beton_16",
    code: undefined,
    name: "Besi Beton 16mm x 12m SNI",
    category: "Besi Beton",
    unit: "Batang",
  },
];

export const itemById = (id: string): Item | undefined =>
  items.find((i) => i.id === id);
