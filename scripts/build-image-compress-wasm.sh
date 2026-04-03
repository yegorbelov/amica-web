#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v emcc >/dev/null 2>&1; then
  echo "emcc not found. Install Emscripten (https://emscripten.org) or use: docker run --rm -v \"\$PWD:/src\" -w /src emscripten/emsdk bash -lc 'bash scripts/build-image-compress-wasm.sh'" >&2
  exit 1
fi

node scripts/ensure-stb.mjs

OUT="$ROOT/src/lib/image-compress/generated"
mkdir -p "$OUT"

# ENVIRONMENT=web,worker: same WASM runs in main thread and in Web Worker (imageCompress.worker.ts).
# After changing flags, run: pnpm run build:wasm
emcc "$ROOT/native/image_compress/compress.cpp" \
  -O3 \
  -I"$ROOT/native/image_compress/third_party/stb" \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME=createImageCompressModule \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s ENVIRONMENT=web,worker \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_compress_image","_free_compress_buffer"]' \
  -s EXPORTED_RUNTIME_METHODS=ccall,cwrap,HEAPU8,HEAP32 \
  -o "$OUT/image_compress.js"
