/**
 * Simple hash-based router.
 * Format: #/quotation/jual/doc_0001
 *         #/deal-tracker
 *         #/parties
 *         #/signature
 *         #/upload
 */

import Alpine from "alpinejs";
import type { DocumentType, DocDirection } from "@/types/schema";

interface Route {
  view: string;       // 'quotation', 'deal-tracker', 'parties', etc.
  direction: DocDirection;
  docId: string;      // document ID (empty for non-doc views)
}

export function parseHash(): Route {
  const hash = window.location.hash.slice(1) || "/quotation/jual";
  const parts = hash.split("/").filter(Boolean);

  // Special views (no docId)
  const specialViews = ["deal-tracker", "payments", "parties", "signature", "upload", "items"];
  if (parts.length === 1 && specialViews.includes(parts[0])) {
    return { view: parts[0], direction: "jual", docId: "" };
  }

  // Document view: /type/direction/docId OR /type/direction (no docId)
  if (parts.length >= 2) {
    const type = parts[0].replace(/-/g, "_") as DocumentType;
    const dir = (parts[1] === "beli" ? "beli" : "jual") as DocDirection;
    const docId = parts[2] || "";
    return { view: type, direction: dir, docId };
  }

  return { view: "quotation", direction: "jual", docId: "" };
}

export function buildHash(view: string, direction: DocDirection, docId: string): string {
  if (["deal-tracker", "payments", "parties", "signature", "upload", "items"].includes(view)) {
    return `#/${view}`;
  }
  const hash = `#/${view.replace(/_/g, "-")}/${direction}`;
  return docId ? `${hash}/${docId}` : hash;
}

export function initRouter() {
  // Apply initial route
  applyRoute(parseHash());

  // Listen for hash changes
  window.addEventListener("hashchange", () => {
    applyRoute(parseHash());
  });
}

function applyRoute(route: Route) {
  const shell = Alpine.store("shell") as any;
  const doc = Alpine.store("doc") as any;

  const specialViews = ["deal-tracker", "payments", "parties", "signature", "upload", "items"];
  if (specialViews.includes(route.view)) {
    shell.setActive(route.view, route.direction);
    if (route.view === "deal-tracker" || route.view === "payments") {
      doc.optionsVisible = false;
    }
    // Trigger loadBody after a tick so stores are updated
    setTimeout(() => {
      const dv = (window as any).documentView;
      if (dv) dv().loadBody();
    }, 0);
  } else {
    const type = route.view as DocumentType;
    doc.setType(type, route.direction);
    shell.setActive(type, route.direction);
    if (route.docId) {
      doc.setCurrent(route.docId);
    }
    // Trigger loadBody
    setTimeout(() => {
      const dv = (window as any).documentView;
      if (dv) dv().loadBody();
    }, 0);
  }
}

/** Update hash without triggering hashchange (silent) */
export function updateHash(view: string, direction: DocDirection, docId: string) {
  const newHash = buildHash(view, direction, docId);
  if (window.location.hash !== newHash) {
    history.replaceState(null, "", newHash);
  }
}