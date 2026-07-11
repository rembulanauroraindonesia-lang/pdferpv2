/**
 * documentView() — master template orchestrator (Alpine x-data factory).
 * Lives on the .document-view wrapper in index.html. Handles:
 *   - exposes the doc list for the scroller chips (reactive on docsVersion)
 *   - loads body partial via htmx on type/instance change (x-effect="loadBody()")
 */
import htmx from "htmx.org";
import type { Document, DocumentType, DocDirection } from "@/types/schema";
import { documentsByType } from "@/data/documents";
import { formatDateID, statusMeta } from "@/lib/format";
import type { DocStore } from "@/state/docStore";

export type DocumentViewComponent = {
  readonly docs: Document[];
  readonly currentId: string;
  statusMeta: typeof statusMeta;
  fmtDate: (iso: string) => string;
  shortNo: (docNo: string) => string;
  revLabel: (doc: Document) => string;
  isCurrent: (id: string) => boolean;
  selectDoc: (id: string) => void;
  loadType: (type: DocumentType, direction: DocDirection) => void;
  loadBody: () => void;
};

export function makeDocumentView(Alpine: typeof import("alpinejs")) {
  const docStore = () => Alpine.store("doc") as DocStore;

  return function documentView(): DocumentViewComponent {
    const self = {
      get docs(): Document[] {
        void docStore().docsVersion;
        return documentsByType(docStore().type);
      },
      get currentId(): string {
        return docStore().currentId;
      },
      statusMeta,
      fmtDate: (iso: string) => formatDateID(iso),

      shortNo(docNo: string): string {
        return docNo.split("/").pop() ?? docNo;
      },
      revLabel(doc: Document): string {
        return doc.revision_count > 0 ? `r${doc.revision_count}` : "";
      },
      isCurrent(id: string): boolean {
        return id === self.currentId;
      },
      selectDoc(id: string) {
        docStore().setCurrent(id);
        self.loadBody();
      },
      loadType(type: DocumentType, direction: DocDirection) {
        docStore().setType(type, direction);
      },
      loadBody() {
        const ds = docStore();
        void ds.currentId;
        void ds.type;
        void ds.direction;
        // NOTE: do NOT void ds.docsVersion here. docsVersion bumps on
        // every line mutation (qty edit, addLine, touch()) — depending
        // on it would re-fetch the partial and clobber the input the
        // user is typing in. linkQuotation() triggers its own htmx
        // reload explicitly when it needs the body to re-render.

        // Deal Tracker: special route — not a document type.
        const shell = Alpine.store("shell") as { activeView: string };
        if (shell.activeView === "deal-tracker") {
          htmx.ajax("get", "/partials/deal-tracker.html", {
            target: "#doc-body",
            swap: "innerHTML",
          });
          return;
        }

        // Parties: master data view — not a document type.
        if (shell.activeView === "parties") {
          htmx.ajax("get", "/partials/parties.html", {
            target: "#doc-body",
            swap: "innerHTML",
          });
          return;
        }

        // Upload: master data library — not a document type.
        if (shell.activeView === "upload") {
          htmx.ajax("get", "/partials/upload.html", {
            target: "#doc-body",
            swap: "innerHTML",
          });
          return;
        }

        // Signature: master data — not a document type.
        if (shell.activeView === "signature") {
          htmx.ajax("get", "/partials/signature.html", {
            target: "#doc-body",
            swap: "innerHTML",
          });
          return;
        }

        // Normal document: filenames use hyphens but type IDs use underscores.
        const filename = ds.type.replace(/_/g, "-") + ".html";
        htmx.ajax("get", `/partials/${filename}`, {
          target: "#doc-body",
          swap: "innerHTML",
        });
      },
    };
    return self;
  };
}
