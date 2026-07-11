/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// DEV: partials are served as static files under /partials/* and loaded by htmx
//      via hx-get. No server-side rendering yet — that arrives with the Hono BFF.
//      The hx-get URLs we use today map 1:1 onto future Hono routes, so the
//      frontend never changes when the backend lands.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Vite already serves /public at root, so /partials/quotation.html resolves
    // to public/partials/quotation.html out of the box. No proxy needed for mockup.
  },
});
