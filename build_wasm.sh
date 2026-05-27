#!/usr/bin/env bash
# Build the WASM bindings and copy artifacts into docs/ so GitHub Pages
# can serve them. Re-run after changing wgsql or wgsql-wasm.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> wasm-pack build crates/wgsql-wasm"
wasm-pack build crates/wgsql-wasm --target web --release

echo "==> copy artifacts -> docs/"
cp crates/wgsql-wasm/pkg/wgsql_wasm.js \
   crates/wgsql-wasm/pkg/wgsql_wasm_bg.wasm \
   crates/wgsql-wasm/pkg/wgsql_wasm.d.ts \
   crates/wgsql-wasm/pkg/wgsql_wasm_bg.wasm.d.ts \
   docs/

echo "==> done"
ls -la docs/wgsql_wasm_bg.wasm
