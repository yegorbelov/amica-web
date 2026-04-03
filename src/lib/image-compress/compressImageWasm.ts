import {
  JPEG_QUALITY,
  sniffRasterFormat,
} from './imageCompressCore';

export { JPEG_QUALITY };

/**
 * When to attempt WASM re-encode. Any image/* except SVG (huge text) and GIF (animation).
 * Unsupported formats fail fast in compressRasterImage via magic-byte sniff.
 */
export function shouldTryRasterCompress(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === 'image/svg+xml' || t === 'image/gif') {
    return false;
  }
  if (t.startsWith('image/')) {
    return true;
  }
  if (t !== '' && t !== 'application/octet-stream') {
    return false;
  }
  return /\.(jpe?g|jfif|pjpeg|png|webp)$/i.test(file.name);
}

function devWarn(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.warn('[image-compress]', ...args);
  }
}

type WorkerResultMsg =
  | {
      type: 'result';
      id: number;
      ok: true;
      outName: string;
      jpegBuffer: ArrayBuffer;
    }
  | { type: 'result'; id: number; ok: false };

let nextJobId = 1;
const pending = new Map<
  number,
  { resolve: (file: File | null) => void }
>();

let workerInstance: Worker | null = null;

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('./imageCompress.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerInstance.onmessage = (ev: MessageEvent<WorkerResultMsg>) => {
      const msg = ev.data;
      if (msg.type !== 'result') {
        return;
      }
      const slot = pending.get(msg.id);
      pending.delete(msg.id);
      if (!slot) {
        return;
      }
      if (msg.ok) {
        slot.resolve(
          new File([new Uint8Array(msg.jpegBuffer)], msg.outName, {
            type: 'image/jpeg',
          }),
        );
      } else {
        slot.resolve(null);
      }
    };
    workerInstance.onerror = (err) => {
      devWarn('image compress worker error', err);
      for (const [, { resolve }] of pending) {
        resolve(null);
      }
      pending.clear();
      workerInstance?.terminate();
      workerInstance = null;
    };
  }
  return workerInstance;
}

/**
 * Re-encode JPEG/PNG to JPEG via WASM in a Web Worker (stb).
 * Returns null on unsupported format, failure, or stub build.
 */
export async function compressRasterImage(
  file: File,
  quality: number = JPEG_QUALITY,
): Promise<File | null> {
  try {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (!sniffRasterFormat(head)) {
      return null;
    }

    const buffer = await file.arrayBuffer();
    const id = nextJobId++;

    return await new Promise<File | null>((resolve) => {
      pending.set(id, { resolve });
      try {
        getWorker().postMessage(
          {
            type: 'compress',
            id,
            buffer,
            originalName: file.name,
            quality,
          },
          [buffer],
        );
      } catch (err) {
        pending.delete(id);
        devWarn('compressRasterImage postMessage failed', err);
        resolve(null);
      }
    });
  } catch (err) {
    devWarn('compressRasterImage failed', err);
    return null;
  }
}
