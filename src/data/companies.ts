import type { Company } from "@/types/schema";

/**
 * CALON COLLECTION: companies
 * ----------------------------------------------------------------------------
 * DB note: Saat PocketBase nyala, file ini → seed data di migration.
 * Query di BFF: GET /api/collections/companies/records/:id
 */
export const companies: Company[] = [
  {
    id: "co_rembulan_aurora",
    name: "PT. REMBULAN AURORA INDONESIA",
    address:
      "Jl. Kedoya Agave VI Blok C1 No. 19 RT 10 RW 4,\nKedoya Selatan, Kebon Jeruk, Jakarta Barat",
    phone: "(+62) 85110811781",
    email: "rembulan.aurora@example.com",
    npwp: undefined,
    logo: undefined,
  },
];

export const companyById = (id: string): Company | undefined =>
  companies.find((c) => c.id === id);
