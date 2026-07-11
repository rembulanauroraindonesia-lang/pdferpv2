/**
 * seed.ts — seeds in-memory mock data into PocketBase on first run.
 * ----------------------------------------------------------------------------
 * Called after initDB() succeeds. Checks if data already exists (by querying
 * the `companies` collection), and if empty, inserts all seed data.
 *
 * This is a dev convenience — in production, collections are managed via
 * the PocketBase admin UI or migrations.
 */
import { pb, usePocketBase } from "./db";
import { documents } from "@/data/documents";
import { documentLines } from "@/data/documentLines";
import { parties } from "@/data/parties";
import { companies } from "@/data/companies";
import { items } from "@/data/items";
import { signatories } from "@/data/signatories";
import { bankAccounts } from "@/data/bankAccounts";
import { staff } from "@/data/staff";
import { terms } from "@/data/terms";

export async function seedIfNeeded(): Promise<void> {
  if (!usePocketBase()) return;

  // Check if data already exists
  try {
    const existing = await pb.collection("companies").getFullList({ count: 1 });
    if (existing.length > 0) return; // Already seeded
  } catch {
    // Collection might not exist yet — skip seeding
    return;
  }

  console.log("[DB] Seeding initial data...");

  try {
    // Seed companies
    for (const co of companies) {
      await pb.collection("companies").create({
        name: co.name,
        address: co.address,
        phone: co.phone,
        email: co.email || "",
        npwp: co.npwp || "",
      });
    }

    // Seed parties
    for (const p of parties) {
      await pb.collection("parties").create({
        name: p.name,
        address: p.address || "",
        contact_person: p.contact_person,
        phone: p.contact_phone || "",
        email: "",
        npwp: "",
        notes: "",
        type: "both",
        bank_name: p.bank_name || "",
        bank_account: p.bank_account || "",
        bank_account_name: p.bank_account_name || "",
        is_active: p.is_active,
      });
    }

    // Seed items
    for (const item of items) {
      await pb.collection("items").create({
        code: item.code || "",
        name: item.name,
        category: item.category || "",
        unit: item.unit,
        description: "",
        notes: "",
      });
    }

    // Seed signatories
    for (const s of signatories) {
      await pb.collection("signatories").create({
        name: s.name,
        role: s.role,
        is_active: s.is_active,
      });
    }

    // Seed staff
    for (const st of staff) {
      await pb.collection("staff").create({
        name: st.name,
        role: "",
        phone: "",
        email: "",
      });
    }

    // Seed bank accounts
    for (const ba of bankAccounts) {
      await pb.collection("bank_accounts").create({
        bank_name: ba.bank,
        account_number: ba.account_no,
        account_name: ba.account_name,
        branch: "",
        swift_code: "",
        currency: "IDR",
        is_default: true,
      });
    }

    // Seed documents (snapshot strategy — full doc JSON in `data` field)
    for (const doc of documents) {
      await pb.collection("documents").create({
        doc_no: doc.doc_no,
        type: doc.type,
        direction: doc.direction,
        status: doc.status,
        revision_count: doc.revision_count,
        parent_id: doc.parent_doc_id || "",
        issue_date: doc.date,
        due_date: doc.due_date || "",
        party: doc.party_id || "",
        payment_terms: doc.payment_method === "nett" && doc.payment_net_days ? `NETT ${doc.payment_net_days} Hari` : "Cash",
        shipping_address: doc.shipping_address || "",
        notes: "",
        data: JSON.stringify(doc),
      });
    }

    // Seed document lines
    for (const line of documentLines) {
      await pb.collection("document_lines").create({
        document: line.document_id,
        line_no: line.line_no,
        item_code: "",
        item_name: line.item_name,
        qty: line.qty,
        unit: line.unit,
        unit_price: line.unit_price,
        buy_per_unit: line.pricing?.buy_per_unit || 0,
        discount_pct: 0,
        line_total: line.qty * line.unit_price,
      });
    }

    // Seed terms
    for (const t of terms) {
      await pb.collection("terms").create({
        document_id: t.document_id,
        seq: t.seq,
        body: t.body,
      });
    }

    console.log("[DB] Seed complete");
  } catch (err) {
    console.error("[DB] Seed failed:", err);
  }
}