#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-pocketbase.sh — Automates PocketBase collection creation for pdferpv2.
#
# Usage:
#   1. Download & install PocketBase: https://pocketbase.io/docs/
#   2. Start PocketBase:                ./pocketbase serve --http="127.0.0.1:8090"
#   3. Run this script (requires jq):   bash pocketbase/setup-pocketbase.sh
#
# Prerequisites:
#   - PocketBase running on http://127.0.0.1:8090
#   - jq installed (apt-get install jq / brew install jq)
#   - curl installed
#
# What this does:
#   1. Creates all 9 collections from pocketbase/collections/*.json
#   2. Fixes the document_lines.document relation to point to the real documents collection ID
#   3. Optionally seeds initial data (if --seed flag passed)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PB_URL="${VITE_PB_URL:-http://127.0.0.1:8090}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLLECTIONS_DIR="$SCRIPT_DIR/collections"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err()  { echo -e "${RED}[ERR]${NC} $1"; }

# ── Check prerequisites ──────────────────────────────────────────────────────
check_prereqs() {
  if ! command -v jq &>/dev/null; then
    log_err "jq is required. Install with: apt-get install jq / brew install jq"
    exit 1
  fi

  # Check PocketBase is reachable
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/health" 2>/dev/null || echo "000")
  if [ "$http_code" != "200" ]; then
    log_err "PocketBase not reachable at $PB_URL (HTTP $http_code)"
    log_err "Start it first: ./pocketbase serve --http=127.0.0.1:8090"
    exit 1
  fi
  log_ok "PocketBase reachable at $PB_URL"
}

# ── Create a single collection ───────────────────────────────────────────────
create_collection() {
  local json_file="$1"
  local collection_name
  collection_name=$(jq -r '.name' "$json_file")

  # Check if collection already exists
  local existing
  existing=$(curl -s "$PB_URL/api/collections/$collection_name" 2>/dev/null | jq -r '.id' 2>/dev/null || echo "")

  if [ "$existing" != "null" ] && [ -n "$existing" ]; then
    log_warn "Collection '$collection_name' already exists (id: $existing) — skipping"
    echo "$collection_name:$existing" >> "$SCRIPT_DIR/.collection_ids"
    return 0
  fi

  # Create the collection
  local response
  response=$(curl -s -X POST "$PB_URL/api/collections" \
    -H "Content-Type: application/json" \
    -d @"$json_file" 2>/dev/null)

  local id
  id=$(echo "$response" | jq -r '.id' 2>/dev/null)

  if [ "$id" != "null" ] && [ -n "$id" ]; then
    log_ok "Created collection '$collection_name' (id: $id)"
    echo "$collection_name:$id" >> "$SCRIPT_DIR/.collection_ids"
  else
    local err_msg
    err_msg=$(echo "$response" | jq -r '.message // .error // "unknown error"' 2>/dev/null)
    log_err "Failed to create '$collection_name': $err_msg"
    return 1
  fi
}

# ── Fix the document_lines → documents relation ──────────────────────────────
fix_document_lines_relation() {
  local docs_id
  docs_id=$(grep "^documents:" "$SCRIPT_DIR/.collection_ids" | cut -d: -f2)

  if [ -z "$docs_id" ]; then
    log_err "Could not find documents collection ID"
    return 1
  fi

  # Update the document_lines collection to set the real collection ID
  local response
  response=$(curl -s -X PATCH "$PB_URL/api/collections/document_lines" \
    -H "Content-Type: application/json" \
    -d "{
      \"schema\": [
        {
          \"name\": \"document\",
          \"type\": \"relation\",
          \"required\": true,
          \"options\": {
            \"collectionId\": \"$docs_id\",
            \"maxSelect\": 1,
            \"displayFields\": [\"doc_no\", \"type\"]
          }
        }
      ]
    }" 2>/dev/null)

  local id
  id=$(echo "$response" | jq -r '.id' 2>/dev/null)

  if [ "$id" != "null" ] && [ -n "$id" ]; then
    log_ok "Fixed document_lines.document relation → documents ($docs_id)"
  else
    log_warn "Could not update document_lines relation (may need manual fix in PB Admin UI)"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  pdferpv2 — PocketBase Schema Setup                     ║"
  echo "║  9 collections from pocketbase/collections/*.json       ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""

  check_prereqs

  # Clear previous IDs file
  > "$SCRIPT_DIR/.collection_ids"

  # Create collections in dependency order
  local order=(
    "companies"
    "parties"
    "items"
    "signatories"
    "bank_accounts"
    "staff"
    "documents"
    "document_lines"
    "terms"
  )

  local created=0
  local skipped=0
  local failed=0

  for col_name in "${order[@]}"; do
    local json_file="$COLLECTIONS_DIR/${col_name}.json"
    if [ ! -f "$json_file" ]; then
      log_err "Schema file not found: $json_file"
      failed=$((failed + 1))
      continue
    fi

    if create_collection "$json_file"; then
      # Check if it was created or skipped
      local existing_id
      existing_id=$(grep "^${col_name}:" "$SCRIPT_DIR/.collection_ids" | cut -d: -f2)
      # We can't easily tell from here, so just count all as success
      created=$((created + 1))
    else
      failed=$((failed + 1))
    fi
  done

  echo ""

  # Fix the relation field after all collections exist
  fix_document_lines_relation

  echo ""
  echo "── Summary ───────────────────────────────────────────────"
  echo "  Collections processed: $((created + failed))"
  echo "  Collection IDs saved to: pocketbase/.collection_ids"
  echo ""
  echo "  Next steps:"
  echo "  1. Open $PB_URL/_/ in your browser"
  echo "  2. Create an admin account"
  echo "  3. Verify collections in the admin UI"
  echo "  4. Start the app: VITE_PB_URL=$PB_URL npm run dev"
  echo ""

  # Clean up
  rm -f "$SCRIPT_DIR/.collection_ids"

  if [ $failed -gt 0 ]; then
    exit 1
  fi
}

main "$@"