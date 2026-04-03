import type { EmscriptenModule } from './emscripten';

export const JPEG_QUALITY = 60;

export function clampJpegQuality(quality: number): number {
  return Math.min(100, Math.max(1, Math.round(quality)));
}

export function sniffRasterFormat(buffer: Uint8Array): 'jpeg' | 'png' | null {
  if (buffer.length < 3) {
    return null;
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  return null;
}

export function jpegNameFromOriginalName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${base}.jpg`;
}

/**
 * Encode raster bytes to JPEG via WASM at a single quality (1–100).
 */
export function compressRasterBytesWithModule(
  Module: EmscriptenModule,
  data: Uint8Array,
  quality: number,
): Uint8Array | null {
  const q = clampJpegQuality(quality);
  const compress = Module.cwrap('compress_image', 'number', [
    'number',
    'number',
    'number',
    'number',
  ]);
  const freeCompressBuffer = Module.cwrap('free_compress_buffer', null, [
    'number',
  ]);

  const inpPtr = Module._malloc(data.length);
  if (!inpPtr) {
    return null;
  }
  Module.HEAPU8.set(data, inpPtr);

  const outLenPtr = Module._malloc(4);
  if (!outLenPtr) {
    Module._free(inpPtr);
    return null;
  }
  Module.HEAP32[outLenPtr >> 2] = 0;

  const outPtr = compress(inpPtr, data.length, q, outLenPtr) as number;
  const outLen = Module.HEAP32[outLenPtr >> 2] | 0;

  Module._free(inpPtr);
  Module._free(outLenPtr);

  if (!outPtr || outLen <= 0) {
    return null;
  }

  const jpeg = new Uint8Array(
    Module.HEAPU8.subarray(outPtr, outPtr + outLen).slice(),
  );
  freeCompressBuffer(outPtr);

  return jpeg;
}
