/**
 * persist.ts — bridge between in-memory data arrays and PocketBase.
 * ----------------------------------------------------------------------------
 * Provides three categories of function:
 *   1. loadFromDB()  — replace in-memory arrays with PB data (on app start)
 *   2. saveCurrentDoc()  — persist current document + lines to PB (on Simpan)
 *   3. savePartyToDB / saveSignatoryToDB  — persist master data CRUD
 *
 * Design principle: in-memory arrays remain the single source of truth for
 * the UI. PocketBase is a write-through persistence layer only.
 */
import { usePocketBase } from "./db";
import {
  fetchDocuments,
  saveDocument,
  fetchDocumentLines,
  saveDocumentLines,
  fetchParties,
  fetchCompanies,
  fetchSignatories,
  fetchBankAccounts,
  fetchStaff,
  fetchItems,
  fetchTerms,
  saveParty,
  saveSignatory,
} from "./api";
import { documents } from "@/data/documents";
import { documentLines } from "@/data/documentLines";
import { parties } from "@/data/parties";
import { companies } from "@/data/companies";
import { signatories } from "@/data/signatories";
import { bankAccounts } from "@/data/bankAccounts";
import { staff } from "@/data/staff";
import { items } from "@/data/items";
import { terms } from "@/data/terms";
import type { Party, Signatory } from "@/types/schema";

/** Load all data from PocketBase into in-memory arrays */
export async function loadFromDB(): Promise<boolean> {
  if (!usePocketBase()) return false;
  try {
    const [docs, lines, pts, cos, sigs, bas, sts, itms, trms] = await Promise.all([
      fetchDocuments(),
      fetchDocumentLines(""),
      fetchParties(),
      fetchCompanies(),
      fetchSignatories(),
      fetchBankAccounts(),
      fetchStaff(),
      fetchItems(),
      fetchTerms(),
    ]);

    // Replace in-memory arrays (keep references — same array objects)
    documents.length = 0;
    documents.push(...docs);

    documentLines.length = 0;
    documentLines.push(...lines);

    parties.length = 0;
    parties.push(...pts);

    companies.length = 0;
    companies.push(...cos);

    signatories.length = 0;
    signatories.push(...sigs);

    bankAccounts.length = 0;
    bankAccounts.push(...bas);

    staff.length = 0;
    staff.push(...sts);

    items.length = 0;
    items.push(...itms);

    terms.length = 0;
    terms.push(...trms);

    console.log(
      `[DB] Loaded: ${docs.length} docs, ${lines.length} lines, ${pts.length} parties, ${itms.length} items`,
    );
    return true;
  } catch (err) {
    console.error("[DB] loadFromDB failed:", err);
    return false;
  }
}

/** Save current document state to PocketBase */
export async function saveCurrentDoc(docId: string): Promise<boolean> {
  if (!usePocketBase()) return false;
  const doc = documents.find((d) => d.id === docId);
  if (!doc) return false;
  try {
    await saveDocument(doc);
    const lines = documentLines.filter((l) => l.document_id === docId);
    await saveDocumentLines(docId, lines);
    return true;
  } catch (err) {
    console.error("[DB] saveCurrentDoc failed:", err);
    return false;
  }
}

/** Save a party (create or update) */
export async function savePartyToDB(party: Party): Promise<string> {
  if (!usePocketBase()) return party.id;
  return saveParty(party);
}

/** Save a signatory (create or update) */
export async function saveSignatoryToDB(sig: Signatory): Promise<string> {
  if (!usePocketBase()) return sig.id;
  return saveSignatory(sig);
}