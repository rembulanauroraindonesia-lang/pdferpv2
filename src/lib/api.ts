/**
 * api.ts — PocketBase data access layer.
 * ----------------------------------------------------------------------------
 * Exports async functions that read/write PocketBase collections.
 * Every function checks `usePocketBase()` first and falls back gracefully
 * (returns empty arrays, never throws).
 *
 * The in-memory arrays in src/data/ remain the single source of truth for the
 * UI; this module is used by persist.ts to sync data into/out of PocketBase.
 */
import { pb, usePocketBase } from "./db";
import type { Document, DocumentLine, Party, Company, Item, Signatory, BankAccount } from "@/types/schema";
import type { Staff } from "@/data/staff";

// ── Documents ──────────────────────────────────────────────────────────────────

export async function fetchDocuments(): Promise<Document[]> {
  if (!usePocketBase()) return [];
  try {
    const records = await pb.collection("documents").getFullList({ sort: "-created" });
    return records.map((r) => {
      let data: Record<string, unknown> = {};
      try {
        data = r.data ? (JSON.parse(r.data as string) as Record<string, unknown>) : {};
      } catch {
        data = {};
      }
      return {
        id: r.id,
        ...data,
        type: (data.type as Document["type"]) || r.type,
        doc_no: (data.doc_no as string) || r.doc_no,
      } as Document;
    });
  } catch (err) {
    console.error("[API] fetchDocuments failed:", err);
    return [];
  }
}

export async function saveDocument(doc: Document): Promise<string> {
  if (!usePocketBase()) return doc.id;
  try {
    if (doc.id.startsWith("doc_new_")) {
      // Create new
      const record = await pb.collection("documents").create({
        doc_no: doc.doc_no,
        type: doc.type,
        direction: doc.direction,
        status: doc.status,
        revision_count: doc.revision_count,
        parent_id: doc.parent_doc_id || "",
        issue_date: doc.date,
        due_date: doc.due_date || "",
        party: doc.party_id || "",
        payment_terms:
          doc.payment_method === "nett" && doc.payment_net_days
            ? `NETT ${doc.payment_net_days} Hari`
            : "Cash",
        shipping_address: doc.shipping_address || "",
        notes: "",
        data: JSON.stringify(doc),
      });
      return record.id;
    } else {
      // Update existing
      await pb.collection("documents").update(doc.id, {
        doc_no: doc.doc_no,
        type: doc.type,
        direction: doc.direction,
        status: doc.status,
        revision_count: doc.revision_count,
        issue_date: doc.date,
        due_date: doc.due_date || "",
        data: JSON.stringify(doc),
      });
      return doc.id;
    }
  } catch (err) {
    console.error("[API] saveDocument failed:", err);
    return doc.id;
  }
}

// ── Document Lines ─────────────────────────────────────────────────────────────

export async function fetchDocumentLines(_docId: string): Promise<DocumentLine[]> {
  if (!usePocketBase()) return [];
  try {
    const records = await pb.collection("document_lines").getFullList({ sort: "line_no" });
    return records.map((r) => ({
      id: r.id,
      document_id: r.document as string,
      line_no: r.line_no as number,
      item_name: r.item_name as string,
      qty: r.qty as number,
      unit: r.unit as string,
      unit_price: r.unit_price as number,
    })) as DocumentLine[];
  } catch (err) {
    console.error("[API] fetchDocumentLines failed:", err);
    return [];
  }
}

export async function saveDocumentLines(docId: string, lines: DocumentLine[]): Promise<void> {
  if (!usePocketBase()) return;
  try {
    // Delete existing lines for this document, then re-insert
    const existing = await pb.collection("document_lines").getFullList({
      filter: `document='${docId}'`,
    });
    for (const e of existing) {
      await pb.collection("document_lines").delete(e.id);
    }
    for (const line of lines) {
      await pb.collection("document_lines").create({
        document: docId,
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
  } catch (err) {
    console.error("[API] saveDocumentLines failed:", err);
  }
}

// ── Parties ────────────────────────────────────────────────────────────────────

export async function fetchParties(): Promise<Party[]> {
  if (!usePocketBase()) return [];
  try {
    const records = await pb.collection("parties").getFullList();
    return records.map((r) => ({
      id: r.id,
      name: r.name as string,
      address: (r.address as string) || undefined,
      contact_person: r.contact_person as string,
      contact_phone: (r.phone as string) || undefined,
      bank_name: (r.bank_name as string) || undefined,
      bank_account: (r.bank_account as string) || undefined,
      bank_account_name: (r.bank_account_name as string) || undefined,
      is_active: (r.is_active as boolean) ?? true,
    })) as Party[];
  } catch (err) {
    console.error("[API] fetchParties failed:", err);
    return [];
  }
}

export async function saveParty(party: Party): Promise<string> {
  if (!usePocketBase()) return party.id;
  try {
    if (party.id.startsWith("pa_new_")) {
      const record = await pb.collection("parties").create({
        name: party.name,
        address: party.address || "",
        contact_person: party.contact_person,
        phone: party.contact_phone || "",
        email: "",
        npwp: "",
        notes: "",
        type: "both",
        bank_name: party.bank_name || "",
        bank_account: party.bank_account || "",
        bank_account_name: party.bank_account_name || "",
        is_active: party.is_active,
      });
      return record.id;
    } else {
      await pb.collection("parties").update(party.id, {
        name: party.name,
        address: party.address || "",
        contact_person: party.contact_person,
        phone: party.contact_phone || "",
        bank_name: party.bank_name || "",
        bank_account: party.bank_account || "",
        bank_account_name: party.bank_account_name || "",
        is_active: party.is_active,
      });
      return party.id;
    }
  } catch (err) {
    console.error("[API] saveParty failed:", err);
    return party.id;
  }
}

// ── Companies ──────────────────────────────────────────────────────────────────

export async function fetchCompanies(): Promise<Company[]> {
  if (!usePocketBase()) return [];
  try {
    const records = await pb.collection("companies").getFullList();
    return records.map((r) => ({
      id: r.id,
      name: r.name as string,
      address: r.address as string,
      phone: r.phone as string,
      email: (r.email as string) || undefined,
      npwp: (r.npwp as string) || undefined,
    })) as Company[];
  } catch (err) {
    console.error("[API] fetchCompanies failed:", err);
    return [];
  }
}

// ── Items ──────────────────────────────────────────────────────────────────────

export async function fetchItems(): Promise<Item[]> {
  if (!usePocketBase()) return [];
  try {
    const records = await pb.collection("items").getFullList();
    return records.map((r) => ({
      id: r.id,
      code: (r.code as string) || undefined,
      name: r.name as string,
      category: (r.category as string) || undefined,
      unit: r.unit as string,
    })) as Item[];
  } catch (err) {
    console.error("[API] fetchItems failed:", err);
    return [];
  }
}

// ── Signatories ────────────────────────────────────────────────────────────────

export async function fetchSignatories(): Promise<Signatory[]> {
  if (!usePocketBase()) return [];
  try {
    const records = await pb.collection("signatories").getFullList();
    return records.map((r) => ({
      id: r.id,
      name: r.name as string,
      role: r.role as string,
      is_active: (r.is_active as boolean) ?? true,
    })) as Signatory[];
  } catch (err) {
    console.error("[API] fetchSignatories failed:", err);
    return [];
  }
}

export async function saveSignatory(sig: Signatory): Promise<string> {
  if (!usePocketBase()) return sig.id;
  try {
    if (sig.id.startsWith("si_new_")) {
      const record = await pb.collection("signatories").create({
        name: sig.name,
        role: sig.role,
        is_active: sig.is_active,
      });
      return record.id;
    } else {
      await pb.collection("signatories").update(sig.id, {
        name: sig.name,
        role: sig.role,
        is_active: sig.is_active,
      });
      return sig.id;
    }
  } catch (err) {
    console.error("[API] saveSignatory failed:", err);
    return sig.id;
  }
}

// ── Bank Accounts ──────────────────────────────────────────────────────────────

export async function fetchBankAccounts(): Promise<BankAccount[]> {
  if (!usePocketBase()) return [];
  try {
    const records = await pb.collection("bank_accounts").getFullList();
    return records.map((r) => ({
      id: r.id,
      company_id: "", // will be linked via relation in future
      bank: r.bank_name as string,
      account_no: r.account_number as string,
      account_name: r.account_name as string,
    })) as BankAccount[];
  } catch (err) {
    console.error("[API] fetchBankAccounts failed:", err);
    return [];
  }
}

// ── Staff ──────────────────────────────────────────────────────────────────────

export async function fetchStaff(): Promise<Staff[]> {
  if (!usePocketBase()) return [];
  try {
    const records = await pb.collection("staff").getFullList();
    return records.map((r) => ({
      id: r.id,
      name: r.name as string,
    })) as Staff[];
  } catch (err) {
    console.error("[API] fetchStaff failed:", err);
    return [];
  }
}