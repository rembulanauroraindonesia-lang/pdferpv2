/**
 * uploadLibrary() — scans all documents for uploaded file fields.
 * Returns a reactive array of { id, filename, ext, icon, module, docNo, fieldLabel }.
 */
import { documents } from "@/data/documents";

// Map of Document field → label
const FILE_FIELDS: Record<string, string> = {
  customer_po_file: "Upload PO Customer",
  supplier_pfi_file: "Upload PFI Supplier",
  giro_file: "Upload Scan Giro/Cek",
  payment_proof_file: "Bukti Bayar",
  customer_pfi_file: "PI diTTDCAP Customer",
};

const TYPE_LABELS: Record<string, string> = {
  quotation: "Penawaran",
  sales_order: "Sales Order",
  proforma_invoice: "Proforma Invoice",
  delivery: "Surat Jalan",
  invoice: "Invoice",
  po: "Purchase Order",
  payment: "Pembayaran",
};

function extIcon(ext: string): string {
  const img = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
  if (img.includes(ext)) return "🖼";
  if (ext === "pdf") return "📄";
  return "📎";
}

export function uploadLibrary() {
  function buildFiles() {
    const result: Array<{
      id: string;
      filename: string;
      ext: string;
      icon: string;
      module: string;
      docNo: string;
      fieldLabel: string;
    }> = [];

    for (const doc of documents) {
      const dir = doc.direction === "beli" ? "Beli" : "Jual";
      const module = `${TYPE_LABELS[doc.type] || doc.type} ${dir}`;
      for (const [field, label] of Object.entries(FILE_FIELDS)) {
        const filename = (doc as any)[field] as string | undefined;
        if (filename) {
          const ext = filename.split(".").pop()?.toLowerCase() || "";
          result.push({
            id: `${doc.id}_${field}`,
            filename,
            ext,
            icon: extIcon(ext),
            module,
            docNo: doc.doc_no,
            fieldLabel: label,
          });
        }
      }
    }
    return result;
  }

  return {
    files: buildFiles(),
  };
}
