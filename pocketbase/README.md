# PocketBase Configuration for pdferpv2
# ─────────────────────────────────────────────────────────────────────────────
#
# This directory contains everything needed to set up the PocketBase backend
# for the pdferpv2 document-as-database ERP system.
#
# Quick Start:
#   1. Install PocketBase:  https://pocketbase.io/docs/
#   2. Start PocketBase:    ./pocketbase serve --http="127.0.0.1:8090"
#   3. Run setup script:    bash pocketbase/setup-pocketbase.sh
#   4. Start the app:       VITE_PB_URL=http://127.0.0.1:8090 npm run dev
#
# Architecture:
#   - The frontend (Vite + htmx + Alpine.js) connects directly to PocketBase
#     via the pocketbase JS SDK (src/lib/db.ts)
#   - In-memory arrays (src/data/*.ts) are the UI source of truth
#   - PocketBase is a write-through persistence layer (src/lib/persist.ts)
#   - If PocketBase is not running, the app degrades gracefully to in-memory mock data
#
# Collections (9 total):
#
#   ┌─────────────────┬────────────────────────────────────────────────────────┐
#   │ Collection       │ Purpose                                               │
#   ├─────────────────┼────────────────────────────────────────────────────────┤
#   │ companies        │ Our company info (letterhead)                         │
#   │ parties          │ Customers & suppliers (pihak lawan)                   │
#   │ items            │ Product catalog (no prices — prices live in lines)    │
#   │ documents        │ Business documents (quotation, invoice, PO, etc.)     │
#   │ document_lines   │ Line items within a document                          │
#   │ terms            │ Terms & conditions per document                       │
#   │ signatories      │ Authorized signers per role                           │
#   │ bank_accounts    │ Bank accounts for payment instructions                │
#   │ staff            │ Marketing & operations staff                          │
#   └─────────────────┴────────────────────────────────────────────────────────┘
#
# Key Design Decisions:
#
#   1. DOCUMENT SNAPSHOT PATTERN
#      The `documents` collection has a `data` field (editor type) that stores
#      the full document JSON as a string. This is the "document-as-database"
#      approach — the document IS the data. Structured fields (doc_no, type,
#      status, etc.) are also stored at the top level for filtering/sorting.
#
#   2. NO PRICES IN ITEMS
#      Prices are never stored in the `items` catalog. Each `document_lines`
#      record has its own `unit_price` because the same item can have different
#      prices in different documents (quotation vs PO vs invoice).
#
#   3. DERIVED FIELDS NOT STORED
#      subtotal, ppn, grand_total, line_total are computed by src/lib/calc.ts
#      at runtime. They are NOT stored in the database to avoid sync issues.
#
#   4. SOFT DELETE
#      parties, signatories, and items use `is_active` boolean for soft delete
#      instead of hard deletion, preserving referential integrity.
#
#   5. DOCUMENT LIFECYCLE
#      status: draft → sent → confirmed → invoiced → paid
#      revision_count: max 3 revisions allowed (MAX_REVISIONS constant)
#      parent_id: links to the source document (e.g., SO → Quotation)
#
# Environment Variables:
#
#   VITE_PB_URL  - PocketBase URL (default: http://127.0.0.1:8090)
#                  Set in .env or as environment variable
#
#   Example .env:
#     VITE_PB_URL=http://127.0.0.1:8090
#
# File Structure:
#
#   pocketbase/
#   ├── README.md              ← You are here
#   ├── setup-pocketbase.sh    ← Automated collection creation script
#   └── collections/
#       ├── companies.json
#       ├── parties.json
#       ├── items.json
#       ├── documents.json
#       ├── document_lines.json
#       ├── terms.json
#       ├── signatories.json
#       ├── bank_accounts.json
#       └── staff.json
#
# TypeScript → PocketBase Field Mapping:
#
#   TypeScript Type    →  PocketBase Type
#   ─────────────────────────────────────
#   string             →  text / email / select / date / editor
#   number             →  number
#   boolean            →  bool
#   string (relation)  →  relation
#   File upload        →  file
#
# Security Notes (Development):
#   - All collection rules (listRule, viewRule, createRule, updateRule, deleteRule)
#     are set to empty string "" which means "no access control" — only for dev.
#   - For production, set appropriate rules or use PocketBase's auth system.
#   - See: https://pocketbase.io/docs/collection-rules-and-filters/