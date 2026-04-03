/// <reference lib="webworker" />

import createImageCompressModule from './generated/image_compress.js';
import type { EmscriptenModule } from './emscripten';
import {
  compressRasterBytesWithModule,
  jpegNameFromOriginalName,
  sniffRasterFormat,
} from './imageCompressCore';

type CompressMsg = {
  type: 'compress';
  id: number;
  buffer: ArrayBuffer;
  originalName: string;
  quality: number;
};

type ResultMsg =
  | {
      type: 'result';
      id: number;
      ok: true;
      outName: string;
      jpegBuffer: ArrayBuffer;
    }
  | { type: 'result'; id: number; ok: false };

function isThenable(x: unknown): x is Promise<EmscriptenModule> {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as Promise<unknown>).then === 'function'
  );
}

function hasWasmMemory(mod: unknown): mod is EmscriptenModule {
  const m = mod as Partial<EmscriptenModule> | null;
  return Boolean(
    m &&
    typeof m._malloc === 'function' &&
    typeof m._free === 'function' &&
    typeof m.cwrap === 'function' &&
    m.HEAPU8 instanceof Uint8Array &&
    m.HEAP32 instanceof Int32Array,
  );
}

async function waitForWasmMemory(
  mod: unknown,
  attempts: number = 8,
): Promise<EmscriptenModule | null> {
  if (hasWasmMemory(mod)) {
    return mod;
  }
  for (let i = 0; i < attempts; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (hasWasmMemory(mod)) {
      return mod;
    }
  }
  return null;
}

let modulePromise: Promise<EmscriptenModule | null> | null = null;

async function getWasmModule(): Promise<EmscriptenModule | null> {
  const init = createImageCompressModule as typeof createImageCompressModule & {
    isStub?: boolean;
  };
  if (init.isStub === true) {
    return null;
  }

  if (!modulePromise) {
    modulePromise = (async () => {
      try {
        const wasmUrl = (await import('./generated/image_compress.wasm?url'))
          .default as string;
        const raw = await init({
          locateFile: (path: string) =>
            path.endsWith('.wasm') ? wasmUrl : path,
        });
        const maybeModule = isThenable(raw) ? await raw : raw;
        const mod = await waitForWasmMemory(maybeModule);
        return mod;
      } catch {
        return null;
      }
    })();
  }
  const mod = await modulePromise;
  if (mod === null) {
    modulePromise = null;
  }
  return mod;
}

let jobChain: Promise<void> = Promise.resolve();

function enqueue(job: () => Promise<void>): void {
  jobChain = jobChain
    .then(() => job())
    .catch((err) => {
      console.error('[image-compress-worker]', err);
    });
}

self.onmessage = (ev: MessageEvent<CompressMsg>) => {
  const msg = ev.data;
  if (msg.type !== 'compress') {
    return;
  }

  const { id, buffer, originalName, quality } = msg;

  enqueue(async () => {
    try {
      const data = new Uint8Array(buffer);
      const head = data.subarray(0, Math.min(8, data.length));
      if (!sniffRasterFormat(head)) {
        const fail: ResultMsg = { type: 'result', id, ok: false };
        self.postMessage(fail);
        return;
      }

      const Module = await getWasmModule();
      if (!Module) {
        const fail: ResultMsg = { type: 'result', id, ok: false };
        self.postMessage(fail);
        return;
      }

      const jpeg = compressRasterBytesWithModule(Module, data, quality);
      if (!jpeg) {
        const fail: ResultMsg = { type: 'result', id, ok: false };
        self.postMessage(fail);
        return;
      }

      const out = jpeg.slice().buffer;
      const okMsg: ResultMsg = {
        type: 'result',
        id,
        ok: true,
        outName: jpegNameFromOriginalName(originalName),
        jpegBuffer: out,
      };
      self.postMessage(okMsg, [out]);
    } catch {
      const fail: ResultMsg = { type: 'result', id, ok: false };
      self.postMessage(fail);
    }
  });
};

export {};
