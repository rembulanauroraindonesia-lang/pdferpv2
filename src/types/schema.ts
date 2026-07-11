/**
 * SCHEMA — calon PocketBase collections
 * ----------------------------------------------------------------------------
 * Setiap interface di file ini = satu collection PocketBase di masa depan.
 * Field-fieldnya dipetakan 1:1 dari komponen yang ada di dokumen PDF.
 *
 * Saat PocketBase di-setup, tiap interface ini jadi blueprint collection:
 *   - snake_case field → field collection
 *   - relasi (id ke collection lain) → field relation
 *   - field derived (subtotal, total) → TIDAK disimpan, dihitung di calc.ts
 *
 * Konvensi: ID pakai string (PocketBase pakai 15-char record id).
 */

// ─────────────────────────────────────────────────────────────────────────────
// companies  →  penerbit dokumen (kita sendiri / our own company)
//   PDF: "PT. REMBULAN AURORA INDONESIA" + alamat + telp di header
// ─────────────────────────────────────────────────────────────────────────────
export interface Company {
  id: string;
  name: string; // "PT. REMBULAN AURORA INDONESIA"
  address: string; // multi-line alamat
  phone: string; // "(+62) 85110811781"
  email?: string;
  npwp?: string; // untuk faktur pajak nanti
  // PocketBase: logo → field type "file"
  logo?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// parties  →  penerima / customer / supplier (pihak lawan dokumen)
//   PDF: "Kepada Yth, PT Dok dan Perkapalan Gandasari Indonesia" + "Up: Ibu Tiara"
// ─────────────────────────────────────────────────────────────────────────────
export interface Party {
  id: string;
  name: string; // "PT Dok dan Perkapalan Gandasari Indonesia"
  address?: string;
  contact_person: string; // "Ibu Tiara" — yang di-attention
  contact_phone?: string;
  // Bank account (untuk pembayaran ke supplier / penerimaan dari customer):
  bank_name?: string; // "BCA" / "Mandiri" / etc
  bank_account?: string; // nomor rekening
  bank_account_name?: string; // atas nama rekening
  is_active: boolean; // true = aktif, false = nonaktif (soft delete)
  // PocketBase: bisa di-relate ke Company kalau party = company lain,
  // tapi dipisah supaya fleksibel (party bisa customer ATAU supplier)
}

// ─────────────────────────────────────────────────────────────────────────────
// items  →  master katalog barang/jasa (yang dijual/beli)
//   PDF: "Plat Kapal 12mm x 8' x 30' Non Class" (nama barang di baris quotation)
// ─────────────────────────────────────────────────────────────────────────────
export interface Item {
  id: string;
  code?: string; // SKU/part number (belum ada di PDF, placeholder)
  name: string; // "Plat Kapal 12mm x 8' x 30' Non Class"
  category?: string; // "Plat Kapal" — untuk grouping
  unit: string; // "Pcs" / "Lembar" / "Kg"
  // Harga tidak disimpan di Item karena beda dokumen beda harga;
  // harga hidup di document_lines. Item hanya definisi barangnya.
}

// ─────────────────────────────────────────────────────────────────────────────
// documents  →  satu dokumen (quotation / invoice / PO / payment)
//   PDF: baris "Tanggal / No / Perihal: Penawaran Harga"
// ─────────────────────────────────────────────────────────────────────────────
export type DocumentType =
  | "quotation" // Penawaran Harga
  | "sales_order" // Sales Order
  | "proforma_invoice" // Proforma Invoice (JUAL atau BELI)
  | "delivery" // Surat Jalan (JUAL)
  | "pickup" // Pickup Memo (BELI)
  | "invoice" // Faktur/Invoice (JUAL atau BELI)
  | "po" // Purchase Order
  | "payment"; // Bukti Pembayaran

export type DocDirection = "jual" | "beli";

export type DocumentStatus =
  | "draft"
  | "sent" // sudah dikirim ke party
  | "confirmed" // dikonfirmasi party
  | "invoiced" // quotation → invoice
  | "paid"
  | "cancelled";

/** Bagaimana multi-halaman dokumen ditampilkan saat item melebihi 1 A4. */
export type PageLayout = "stack" | "side";

export interface Document {
  id: string;
  doc_no: string; // "044/PTRAI/SR/OFF/2026" — unik
  type: DocumentType; // "quotation"
  direction: DocDirection; // "jual" | "beli" — sale vs purchase
  date: string; // ISO "2026-05-11" — tanggal dokumen (editable di UI)
  subject: string; // "Penawaran Harga" (Perihal)
  salutation: string; // "Dengan Hormat, Kami ingin memberikan..." (pembuka)
  status: DocumentStatus; // workflow state

  // Lifecycle (terpisah dari tanggal dokumen):
  saved_at?: string; // ISO timestamp dokumen terakhir di-Simpan (locked)
  last_revision_at?: string; // ISO timestamp revisi terakhir
  revision_count: number; // berapa kali sudah direvisi (maks 3)

  // Presentasi (UI-level, tapi persisted per dokumen):
  page_layout: PageLayout; // default "stack"

  // Relasi (PocketBase relation fields):
  company_id: string; // → companies.id (penerbit)
  party_id: string; // → parties.id (penerima)
  signatory_id?: string; // → signatories.id (penanda tangan)
  parent_doc_id?: string; // → documents.id (asal-usul: SO dari Penawaran, dll)

  // SO/PO-specific fields (optional, populated for sales_order / purchase_order):
  customer_po_no?: string; // nomor PO customer yang jadi acuan SO
  customer_po_file?: string; // filename PO customer (upload — PocketBase file field)
  shipping_address?: string; // alamat kirim (kalau beda dari alamat customer)
  pickup_address?: string; // alamat penjemputan (hanya dipakai saat shipping_terms === "Locco")
  shipping_terms?: ShippingTerms; // Franco/Locco/FOB/CIF
  due_date?: string; // ISO tanggal jatuh tempo pembayaran
  due_date_ref?: DueDateRef; // acuan hitung jatuh tempo: \"delivery\" | \"invoice\"
  payment_net_days?: number; // NETT X hari (15 | 30 | 45), hanya berlaku saat payment_method === \"nett\"
  delivery_date?: string; // ISO tanggal rencana pengiriman
  invoice_received_date?: string; // ISO tanggal invoice diterima (acuan jatuh tempo NETT)
  marketing_staff_id?: string; // → staff.id — staff marketing yang handle

  // PFI BELI (proforma invoice purchase-side) — form internal:
  // Upload PFI dari supplier:
  supplier_pfi_no?: string; // nomor PFI dari supplier (e.g. "INV/2026/001")
  supplier_pfi_file?: string; // filename PFI supplier yang di-upload
  // Metode pembayaran:
  payment_method?: PaymentMethodBeli; // Cash / Giro / Cek Tunai / Tempo
  // Syarat & ketentuan pembayaran:
  payment_terms_beli?: string; // e.g. "Nett 30 Hari", "Cash Before Delivery"
  // Detail Giro / Cek Tunai (hanya saat payment_method = giro/cek_tunai):
  giro_no?: string; // nomor giro/cek
  giro_bank?: string; // bank penerbit giro/cek
  giro_cair_date?: string; // ISO tanggal cair giro/cek
  giro_amount?: number; // jumlah giro/cek
  // Upload scan Giro/Cek:
  giro_file?: string; // filename scan giro/cek
  // Rekening bank supplier (untuk transfer):
  supplier_bank_name?: string; // nama bank supplier
  supplier_bank_account?: string; // no rekening supplier
  supplier_bank_account_name?: string; // atas nama rekening supplier
  // Persetujuan (approval):
  finance_approval?: ApprovalStatus; // status persetujuan keuangan
  finance_approved_by?: string; // nama yang menyetujui
  finance_approval_date?: string; // ISO tanggal persetujuan
  finance_approval_notes?: string; // catatan keuangan
  director_approval?: ApprovalStatus; // status persetujuan direktur
  director_approved_by?: string; // nama direktur
  director_approval_date?: string; // ISO tanggal persetujuan
  director_approval_notes?: string; // catatan direktur
  // Bukti bayar:
  payment_proof_file?: string; // filename bukti bayar yang di-upload

  // PFI JUAL — customer acknowledgment:
  customer_pfi_file?: string; // filename PI diTTDCAP (signed/stamped by customer)

  // ── Delivery (Surat Jalan) — pengiriman detail ──
  delivery_plat_no?: string;       // plat nomor kendaraan
  delivery_vehicle_type?: string;  // tipe mobil (e.g. "Colt Diesel", "Fuso")
  delivery_capacity_kg?: number;   // kapasitas muatan (kg)
  delivery_driver_name?: string;   // nama supir
  delivery_driver_phone?: string;  // no kontak supir

  // Payment-specific fields (used by type: "payment" documents):
  payment_amount?: number;         // jumlah yang dibayar
  pay_channel?: string;            // "tunai" | "transfer" | "giro" | "cek" | "tempo"
  payment_ref?: string;            // no. referensi (bukti transfer, giro, cek)
  payment_date?: string;           // ISO tanggal pembayaran
  payment_notes?: string;          // catatan pembayaran
  giro_created_date?: string;      // ISO tanggal giro/cek dibuat/diterbitkan

  // Catatan: subtotal/ppn/grand_total TIDAK ada di sini — derived dari lines.
  // Lihat src/lib/calc.ts.
}

export type ShippingTerms = "Franco" | "Locco" | "FOB" | "CIF";

export type PaymentMethodBeli = "cash" | "nett";

export type DueDateRef = "delivery" | "invoice";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export const MAX_REVISIONS = 3;

// ─────────────────────────────────────────────────────────────────────────────
// document_lines  →  baris-baris item di dalam satu dokumen
//   PDF: baris tabel "No | Plat Kapal 12mm... | Qty 100 | Harga 29.450.000 | Total"
// ─────────────────────────────────────────────────────────────────────────────
export interface DocumentLine {
  id: string;
  document_id: string; // → documents.id
  line_no: number; // urutan (1, 2, 3...)

  item_id?: string; // → items.id (relasi ke master katalog, boleh kosong = ad-hoc)
  item_name: string; // snapshot nama (bisa beda dari master utk fleksibilitas)

  qty: number; // 100
  unit: string; // "Pcs"
  unit_price: number; // 29450000

  // Optional: pricing analysis (per-line). Populated when user clicks
  // "Hitung Harga Satuan". Stored on its own collection (line_pricings)
  // in production, embedded here for mockup convenience.
  pricing?: LinePricing;

  // total = qty * unit_price → derived, lihat calc.ts. Tidak disimpan.
}

// ─────────────────────────────────────────────────────────────────────────────
// line_pricings  →  analisis harga beli/jual per line item
//   Triggered by "Hitung Harga Satuan" popup on each document line.
//   Bidirectional: fill per-kg OR per-unit, the other auto-derives via weight.
// ─────────────────────────────────────────────────────────────────────────────
export type PaymentTerm = "cash" | "credit";

export interface LinePricing {
  id: string;
  line_id: string; // → document_lines.id

  // Supplier (mirrors parties — could be a customer or supplier party)
  supplier_id?: string; // → parties.id
  supplier_name?: string; // snapshot if ad-hoc

  // Pricing — bidirectional via weight. Filling per-kg derives per-unit
  // and vice versa. Both buy and sell follow the same pattern.
  buy_per_kg: number;
  buy_per_unit: number;
  sell_per_kg: number;
  sell_per_unit: number;

  // Weight per unit (the bridge between per-kg and per-unit)
  buy_weight_per_unit: number; // kg per unit (at purchase)
  sell_weight_per_unit: number; // kg per unit (at sale, may differ from buy)

  // Margin (derived)
  // margin_per_unit = sell_per_unit - buy_per_unit
  // margin_pct = margin_per_unit / buy_per_unit
}

// ─────────────────────────────────────────────────────────────────────────────
// terms  →  syarat & ketentuan per dokumen
//   PDF: "Terms and Conditions: Harga Franco... PPN 11%... Cash before delivery..."
// ─────────────────────────────────────────────────────────────────────────────
export interface Term {
  id: string;
  document_id: string; // → documents.id
  seq: number; // urutan (1-5)
  body: string; // isi term
}

// ─────────────────────────────────────────────────────────────────────────────
// signatories  →  orang yang menandatangani dokumen
//   PDF: "Hormat kami, [signature] Winarto. Direktur."
// ─────────────────────────────────────────────────────────────────────────────
export interface Signatory {
  id: string;
  name: string; // "Winarto"
  role: string; // "Direktur"
  is_active: boolean; // soft delete
  // PocketBase: signature_image → field type "file" (upload scan tanda tangan)
  signature_file?: string; // filename hasil upload (viewable/replaceable)
  signature_image?: string; // [legacy] alias
}

// ─────────────────────────────────────────────────────────────────────────────
// BankAccount  →  rekening untuk pembayaran
//   PDF: "Rekening BNI No. 8900011182 atas nama PT. REMBULAN AURORA INDONESIA"
// ─────────────────────────────────────────────────────────────────────────────
export interface BankAccount {
  id: string;
  company_id: string; // → companies.id
  bank: string; // "BNI"
  account_no: string; // "8900011182"
  account_name: string; // "PT. REMBULAN AURORA INDONESIA"
}
