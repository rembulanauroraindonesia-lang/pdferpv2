/**
 * Data access layer — single import surface untuk placeholder data.
 * ----------------------------------------------------------------------------
 * Saat PocketBase nyala, ganti isi fungsi-fungsi di bawah dengan fetch ke
 * PocketBase REST API (atau panggilan ke Hono BFF). Signature-nya dipertahankan
 * supaya komponen UI tidak perlu berubah.
 *
 * Contoh migrasi (nanti):
 *   export const documentById = async (id) =>
 *     await pb.collection('documents').getOne(id)
 */
export {
  companies,
  companyById,
} from "./companies";
export { parties, partyById } from "./parties";
export { items, itemById } from "./items";
export {
  documents,
  documentById,
  documentsByType,
} from "./documents";
export { documentLines, linesByDocument } from "./documentLines";
export { terms, termsByDocument } from "./terms";
export { signatories, signatoryById } from "./signatories";
export { bankAccounts, bankAccountsByCompany } from "./bankAccounts";
