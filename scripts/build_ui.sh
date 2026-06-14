#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../web/ui"
npm ci
npm run gen:protocol
npm run build
echo "UI build finished: web/ui/dist"
