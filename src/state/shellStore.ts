/**
 * $store.shell — app-shell chrome state (DB Map toggle, active nav view).
 * Registered via Alpine.store("shell", shellStore()) in main.ts.
 */

import { staff } from "@/data/staff";
import type { DocDirection } from "@/types/schema";
import { updateHash } from "@/lib/router";

export interface ShellStore {
  mapOn: boolean;
  activeView: string;
  activeDirection: DocDirection;
  staff: typeof staff;
  sidebarVisible: boolean;
  readonly label: string;
  toggleMap(): void;
  setActive(view: string, direction: DocDirection): void;
  toggleSidebar(): void;
}

export function shellStore(): ShellStore {
  return {
    mapOn: false,
    activeView: "quotation",
    activeDirection: "jual",
    staff,
    sidebarVisible: true,

    toggleMap() {
      this.mapOn = !this.mapOn;
      document.body.classList.toggle("map-on", this.mapOn);
    },
    setActive(view: string, direction: DocDirection) {
      this.activeView = view;
      this.activeDirection = direction;
      updateHash(view, direction, "");
      const key = `${view}_${direction}`;
      document.querySelectorAll(".nav__link").forEach((el) => {
        const elKey = `${el.getAttribute("data-view")}_${el.getAttribute("data-direction")}`;
        el.setAttribute("aria-current", elKey === key ? "page" : "false");
      });
    },
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible;
    },
    // Topbar breadcrumb label — combines view + direction ("Invoice Jual", "PO Beli", etc.)
    get label(): string {
      const labels: Record<string, string> = {
        "deal-tracker": "Deal Tracker",
        parties: "PARTIES",
        upload: "UPLOAD",
        signature: "SIGNATURE",
        quotation: "Penawaran",
        sales_order: "Sales Order",
        proforma_invoice: "Proforma Invoice",
        delivery: "Surat Jalan",
        pickup: "Pick Up",
        invoice: "Invoice",
        po: "Purchase Order",
        payment: "Pembayaran",
      };
      const base = labels[this.activeView] ?? "—";
      if (this.activeView === "deal-tracker") return base;
      if (this.activeView === "parties") return base;
      if (this.activeView === "upload") return base;
      if (this.activeView === "signature") return base;
      if (this.activeView === "quotation" || this.activeView === "po" || this.activeView === "payment" || this.activeView === "sales_order") {
        return base;
      }
      // Directional views: append "Jual" or "Beli"
      return `${base} ${this.activeDirection === "jual" ? "Jual" : "Beli"}`;
    },
  };
}
