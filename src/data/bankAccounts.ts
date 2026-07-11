import type { BankAccount } from "@/types/schema";

/**
 * CALON COLLECTION: bank_accounts
 * ----------------------------------------------------------------------------
 * DB note: rekening untuk instruksi pembayaran di terms.
 * Relasi: company_id → companies.id
 */
export const bankAccounts: BankAccount[] = [
  {
    id: "ba_bni_rembulan",
    company_id: "co_rembulan_aurora",
    bank: "BNI",
    account_no: "8900011182",
    account_name: "PT. REMBULAN AURORA INDONESIA",
  },
];

export const bankAccountsByCompany = (companyId: string): BankAccount[] =>
  bankAccounts.filter((b) => b.company_id === companyId);
