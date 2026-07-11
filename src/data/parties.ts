import type { Party } from "@/types/schema";

/**
 * CALON COLLECTION: parties
 * ----------------------------------------------------------------------------
 * DB note: party = pihak lawan (customer/supplier). contact_person = "Up:".
 * Bank fields load into PFI BELI rekening supplier section.
 * is_active = soft delete toggle (false = nonaktif, disembunyikan dari picker).
 */
export const parties: Party[] = [
  {
    id: "pa_gandasari",
    name: "PT Dok dan Perkapalan Gandasari Indonesia",
    address: "Jl. Galangan No. 8, Jakarta Utara",
    contact_person: "Ibu Tiara",
    contact_phone: "(+62) 812-3456-7890",
    bank_name: "BCA",
    bank_account: "008-123-4567",
    bank_account_name: "PT Dok dan Perkapalan Gandasari Indonesia",
    is_active: true,
  },
  {
    id: "pa_tigajaya",
    name: "CV Tiga Jaya",
    address: "Jl. Industri II No. 15, Bekasi",
    contact_person: "Bpk Hendra",
    contact_phone: "(+62) 813-9876-5432",
    bank_name: "Mandiri",
    bank_account: "142-00-1234567-8",
    bank_account_name: "CV Tiga Jaya",
    is_active: true,
  },
  {
    id: "pa_panca",
    name: "PT Panca Wira",
    address: "Jl. MH Thamrin No. 22, Tangerang",
    contact_person: "Ibu Rina",
    contact_phone: "(+62) 815-1122-3344",
    bank_name: "BNI",
    bank_account: "033-987-6543",
    bank_account_name: "PT Panca Wira",
    is_active: true,
  },
  {
    id: "pa_spm",
    name: "PT Sumber Pratama Mandiri",
    address: "Jl. Daan Mogot No. 88, Jakarta Barat",
    contact_person: "Bpk Agus",
    contact_phone: "(+62) 819-5566-7788",
    bank_name: "BCA",
    bank_account: "123-456-7890",
    bank_account_name: "PT Sumber Pratama Mandiri",
    is_active: true,
  },
];

export const partyById = (id: string): Party | undefined =>
  parties.find((p) => p.id === id);
