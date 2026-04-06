import { apiFetch } from '@/utils/apiFetch';
import { websocketManager } from '@/utils/websocket-manager';
import type { WebSocketMessage } from '@/utils/websocket-manager';

const CHUNK_WS_TIMEOUT_MS = 120_000;
const CHUNK_UPLOAD_MAX_INFLIGHT_BYTES = 24 * 1024 * 1024;

/** Adaptive chunk size bounds for message attachment uploads. */
const MIN_MESSAGE_CHUNK_UPLOAD_BYTES = 512 * 1024;
const MAX_MESSAGE_CHUNK_UPLOAD_BYTES = 4 * 1024 * 1024;
const CHUNK_UPLOAD_TARGET_CHUNKS = 128;
const CHUNK_UPLOAD_ALIGNMENT_BYTES = 64 * 1024;

let chunkWsRequestSeq = 0;

const chunkWsPending = new Map<
  number,
  {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

let chunkWsListenerAttached = false;

class InflightBytesLimiter {
  private inFlight = 0;
  private queue: Array<{ bytes: number; resolve: () => void }> = [];
  private readonly maxBytes: number;

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  async acquire(bytes: number): Promise<() => void> {
    const wanted = Math.max(1, bytes);
    await new Promise<void>((resolve) => {
      if (this.inFlight + wanted <= this.maxBytes) {
        this.inFlight += wanted;
        resolve();
        return;
      }
      this.queue.push({ bytes: wanted, resolve });
    });
    return () => {
      this.inFlight = Math.max(0, this.inFlight - wanted);
      while (this.queue.length > 0) {
        const next = this.queue[0];
        if (this.inFlight + next.bytes > this.maxBytes) break;
        this.queue.shift();
        this.inFlight += next.bytes;
        next.resolve();
      }
    };
  }
}

function makeChunkBinaryFrame(
  requestId: number,
  uploadId: string,
  chunkIndex: number,
  payload: Uint8Array,
): Uint8Array {
  const uploadIdBytes = new TextEncoder().encode(uploadId);
  const frame = new Uint8Array(
    4 + 4 + 2 + uploadIdBytes.byteLength + payload.byteLength,
  );
  const dv = new DataView(frame.buffer);
  dv.setUint32(0, requestId, false);
  dv.setUint32(4, chunkIndex, false);
  dv.setUint16(8, uploadIdBytes.byteLength, false);
  frame.set(uploadIdBytes, 10);
  frame.set(payload, 10 + uploadIdBytes.byteLength);
  return frame;
}

function ensureChunkWsResponseListener(): void {
  if (chunkWsListenerAttached) return;
  chunkWsListenerAttached = true;
  websocketManager.on('message', (data: WebSocketMessage) => {
    const t = data.type;
    if (
      t !== 'message_chunk_init_response' &&
      t !== 'message_chunk_part_response' &&
      t !== 'message_chunk_complete_response'
    ) {
      return;
    }
    const raw = data as {
      request_id?: number;
      request_ids?: number[];
      ok?: boolean;
      error?: string;
    };
    const ids =
      Array.isArray(raw.request_ids) && raw.request_ids.length > 0
        ? raw.request_ids.filter((v): v is number => typeof v === 'number')
        : typeof raw.request_id === 'number'
          ? [raw.request_id]
          : [];
    if (ids.length === 0) return;

    ids.forEach((id) => {
      const p = chunkWsPending.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      chunkWsPending.delete(id);
      if (raw.ok === false) {
        p.reject(new Error(raw.error || 'Chunk upload failed'));
      } else {
        p.resolve(data);
      }
    });
  });
}

function chunkWsRpc(
  type: 'message_chunk_init' | 'message_chunk_complete' | 'message_chunk_part',
  payload: Record<string, unknown>,
): Promise<unknown> {
  ensureChunkWsResponseListener();
  const request_id = ++chunkWsRequestSeq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chunkWsPending.delete(request_id);
      reject(new Error('Chunk WS timeout'));
    }, CHUNK_WS_TIMEOUT_MS);
    chunkWsPending.set(request_id, { resolve, reject, timer });
    const sent = websocketManager.sendMessage({
      type,
      request_id,
      data: payload,
    } as unknown as WebSocketMessage);
    if (!sent) {
      clearTimeout(timer);
      chunkWsPending.delete(request_id);
      reject(new Error('WebSocket not connected'));
    }
  });
}

async function chunkWsPartBinaryRpc(
  uploadId: string,
  chunkIndex: number,
  blob: Blob,
): Promise<void> {
  ensureChunkWsResponseListener();
  const request_id = ++chunkWsRequestSeq;
  const raw = new Uint8Array(await blob.arrayBuffer());
  const frame = makeChunkBinaryFrame(request_id, uploadId, chunkIndex, raw);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      chunkWsPending.delete(request_id);
      reject(new Error('Chunk WS timeout'));
    }, CHUNK_WS_TIMEOUT_MS);
    chunkWsPending.set(request_id, {
      resolve: () => resolve(),
      reject,
      timer,
    });

    const sentBinary = websocketManager.sendBinary(frame);
    if (!sentBinary) {
      clearTimeout(timer);
      chunkWsPending.delete(request_id);
      reject(new Error('WebSocket not connected (part payload)'));
    }
  });
}

export const CHUNK_UPLOAD_PARALLELISM = 6;

type MediaKind = 'image' | 'video' | 'audio' | 'file';

function getDeclaredMediaKind(file: File): MediaKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';

  const name = file.name.toLowerCase();
  if (
    ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.mpeg', '.flv', '.m4v'].some(
      (ext) => name.endsWith(ext),
    )
  ) {
    return 'video';
  }
  if (
    ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif'].some(
      (ext) => name.endsWith(ext),
    )
  ) {
    return 'image';
  }
  if (
    ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'].some((ext) =>
      name.endsWith(ext),
    )
  ) {
    return 'audio';
  }
  return 'file';
}

export function shouldUseChunkedVideoUpload(files: File[]): boolean {
  return files.some((f) => f.type.startsWith('video/'));
}

/** Reported with chunk init so VideoFile can store width/height before background ffprobe. */
async function getVideoIntrinsicDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  if (getDeclaredMediaKind(file) !== 'video') {
    return null;
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number } | null>(
      (resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.onloadedmetadata = () => {
          const w = video.videoWidth;
          const h = video.videoHeight;
          video.removeAttribute('src');
          video.load();
          if (w > 0 && h > 0) {
            resolve({ width: w, height: h });
          } else {
            resolve(null);
          }
        };
        video.onerror = () => {
          reject(new Error('video metadata load failed'));
        };
        video.src = url;
      },
    );
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getAdaptiveChunkSizeBytes(fileSize: number): number {
  if (fileSize <= 0) return MIN_MESSAGE_CHUNK_UPLOAD_BYTES;
  const raw = Math.ceil(fileSize / CHUNK_UPLOAD_TARGET_CHUNKS);
  const aligned =
    Math.ceil(raw / CHUNK_UPLOAD_ALIGNMENT_BYTES) *
    CHUNK_UPLOAD_ALIGNMENT_BYTES;
  return Math.min(
    MAX_MESSAGE_CHUNK_UPLOAD_BYTES,
    Math.max(MIN_MESSAGE_CHUNK_UPLOAD_BYTES, aligned),
  );
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * One file → one upload session; chunks uploaded in parallel (up to CHUNK_UPLOAD_PARALLELISM).
 */
async function uploadSingleFileChunks(
  file: File,
  chatId: number,
  onByteProgress: (loadedInThisFile: number) => void,
): Promise<string> {
  const inFlightLimiter = new InflightBytesLimiter(
    CHUNK_UPLOAD_MAX_INFLIGHT_BYTES,
  );
  const requestedChunkSize = getAdaptiveChunkSizeBytes(file.size);
  const videoDims = await getVideoIntrinsicDimensions(file);
  const initPayload: Record<string, unknown> = {
    chat_id: chatId,
    filename: file.name,
    mime_type: file.type || null,
    media_kind: getDeclaredMediaKind(file),
    total_size: file.size,
    chunk_size: requestedChunkSize,
  };
  if (videoDims) {
    initPayload.width = videoDims.width;
    initPayload.height = videoDims.height;
  }
  const initRes = await apiFetch('/api/messages/chunk/init/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initPayload),
  });

  if (!initRes.ok) {
    const err = await parseJsonResponse(initRes);
    throw new Error(
      typeof err === 'object' && err !== null && 'error' in err
        ? String((err as { error: string }).error)
        : `chunk init failed: ${initRes.status}`,
    );
  }

  const initJson = (await initRes.json()) as {
    upload_id: string;
    chunk_count: number;
    chunk_size: number;
  };

  const { upload_id, chunk_count, chunk_size } = initJson;

  let nextIndex = 0;
  /** Sum of bytes uploaded for this file (chunks may finish out of order). */
  let bytesUploadedThisFile = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= chunk_count) {
        return;
      }
      const start = i * chunk_size;
      const end = Math.min(start + chunk_size, file.size);
      const chunkLen = end - start;
      const blob = file.slice(start, end);
      const release = await inFlightLimiter.acquire(chunkLen);
      const fd = new FormData();
      fd.append('upload_id', upload_id);
      fd.append('chunk_index', String(i));
      fd.append('chunk', blob, `part${i}`);

      const partRes = await apiFetch('/api/messages/chunk/part/', {
        method: 'POST',
        body: fd,
      }).finally(() => {
        release();
      });

      if (!partRes.ok) {
        const err = await parseJsonResponse(partRes);
        throw new Error(
          typeof err === 'object' && err !== null && 'error' in err
            ? String((err as { error: string }).error)
            : `chunk part ${i} failed: ${partRes.status}`,
        );
      }

      bytesUploadedThisFile += chunkLen;
      onByteProgress(bytesUploadedThisFile);
    }
  }

  const workers = Math.min(CHUNK_UPLOAD_PARALLELISM, chunk_count);
  await Promise.all(Array.from({ length: workers }, () => worker()));

  return upload_id;
}

/**
 * Upload multiple files in parallel (each file has its own chunk session with parallel chunks).
 * One bundle request creates a single message.
 */
export async function uploadMessageFilesChunked(
  files: File[],
  chatId: number,
  messageText: string,
  onProgress?: (percent: number) => void,
  onFileProgress?: (fileIndex: number, percent: number) => void,
): Promise<unknown> {
  console.info(
    '[chunked upload] start',
    files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      declaredKind: getDeclaredMediaKind(f),
    })),
  );
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const perFileLoaded = new Array<number>(files.length).fill(0);

  const uploadIds: string[] = [];
  for (let idx = 0; idx < files.length; idx += 1) {
    const file = files[idx];
    const uploadId = await uploadSingleFileChunks(
      file,
      chatId,
      (loadedInThisFile) => {
        perFileLoaded[idx] = loadedInThisFile;
        onFileProgress?.(
          idx,
          Math.min(
            100,
            Math.round((loadedInThisFile / Math.max(1, file.size)) * 100),
          ),
        );
        if (onProgress && totalBytes > 0) {
          const sumLoaded = perFileLoaded.reduce((a, b) => a + b, 0);
          onProgress(Math.min(100, Math.round((sumLoaded / totalBytes) * 100)));
        }
      },
    );
    uploadIds.push(uploadId);
  }

  console.info('[chunked upload] upload_ids', uploadIds);

  const completeRes = await apiFetch('/api/messages/chunk/complete/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message: messageText,
      upload_ids: uploadIds,
    }),
  });

  const data = await parseJsonResponse(completeRes);

  if (!completeRes.ok) {
    throw new Error(
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: string }).error)
        : `chunk complete failed: ${completeRes.status}`,
    );
  }

  onProgress?.(100);
  return data;
}

async function uploadSingleFileChunksWs(
  file: File,
  chatId: number,
  onByteProgress: (loadedInThisFile: number) => void,
): Promise<string> {
  const inFlightLimiter = new InflightBytesLimiter(
    CHUNK_UPLOAD_MAX_INFLIGHT_BYTES,
  );
  const requestedChunkSize = getAdaptiveChunkSizeBytes(file.size);
  const videoDimsWs = await getVideoIntrinsicDimensions(file);
  const initData: Record<string, unknown> = {
    chat_id: chatId,
    filename: file.name,
    mime_type: file.type || null,
    media_kind: getDeclaredMediaKind(file),
    total_size: file.size,
    chunk_size: requestedChunkSize,
  };
  if (videoDimsWs) {
    initData.width = videoDimsWs.width;
    initData.height = videoDimsWs.height;
  }
  const initRaw = (await chunkWsRpc('message_chunk_init', initData)) as {
    ok?: boolean;
    upload_id: string;
    chunk_count: number;
    chunk_size: number;
  };

  if (
    !initRaw.upload_id ||
    initRaw.chunk_count == null ||
    !initRaw.chunk_size
  ) {
    throw new Error('Invalid chunk init WS response');
  }

  const { upload_id, chunk_count, chunk_size } = initRaw;

  let nextIndex = 0;
  let bytesUploadedThisFile = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= chunk_count) {
        return;
      }
      const start = i * chunk_size;
      const end = Math.min(start + chunk_size, file.size);
      const chunkLen = end - start;
      const blob = file.slice(start, end);
      const release = await inFlightLimiter.acquire(chunkLen);

      await chunkWsPartBinaryRpc(upload_id, i, blob).finally(() => {
        release();
      });

      bytesUploadedThisFile += chunkLen;
      onByteProgress(bytesUploadedThisFile);
    }
  }

  const workers = Math.min(CHUNK_UPLOAD_PARALLELISM, chunk_count);
  await Promise.all(Array.from({ length: workers }, () => worker()));

  return upload_id;
}

/**
 * Same as {@link uploadMessageFilesChunked} but uses WebSocket binary chunks.
 * Falls back to HTTP if the socket is closed or any step fails.
 */
export async function uploadMessageFilesChunkedViaWs(
  files: File[],
  chatId: number,
  messageText: string,
  onProgress?: (percent: number) => void,
  onFileProgress?: (fileIndex: number, percent: number) => void,
): Promise<unknown> {
  console.info(
    '[chunked upload][ws] start',
    files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      declaredKind: getDeclaredMediaKind(f),
    })),
  );
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const perFileLoaded = new Array<number>(files.length).fill(0);

  const uploadIds: string[] = [];
  for (let idx = 0; idx < files.length; idx += 1) {
    const file = files[idx];
    const uploadId = await uploadSingleFileChunksWs(
      file,
      chatId,
      (loadedInThisFile) => {
        perFileLoaded[idx] = loadedInThisFile;
        onFileProgress?.(
          idx,
          Math.min(
            100,
            Math.round((loadedInThisFile / Math.max(1, file.size)) * 100),
          ),
        );
        if (onProgress && totalBytes > 0) {
          const sumLoaded = perFileLoaded.reduce((a, b) => a + b, 0);
          onProgress(Math.min(100, Math.round((sumLoaded / totalBytes) * 100)));
        }
      },
    );
    uploadIds.push(uploadId);
  }

  console.info('[chunked upload][ws] upload_ids', uploadIds);

  const completeRaw = (await chunkWsRpc('message_chunk_complete', {
    chat_id: chatId,
    message: messageText,
    upload_ids: uploadIds,
  })) as { message_id?: number; status?: string; message?: string };

  if (completeRaw.message_id == null) {
    throw new Error('chunk complete WS failed');
  }

  onProgress?.(100);
  return completeRaw;
}

export async function uploadMessageFilesChunkedPreferWs(
  files: File[],
  chatId: number,
  messageText: string,
  onProgress?: (percent: number) => void,
  onFileProgress?: (fileIndex: number, percent: number) => void,
): Promise<unknown> {
  if (websocketManager.isConnected()) {
    try {
      return await uploadMessageFilesChunkedViaWs(
        files,
        chatId,
        messageText,
        onProgress,
        onFileProgress,
      );
    } catch (e) {
      console.warn('[chunked upload] WS failed, falling back to HTTP', e);
    }
  }
  return uploadMessageFilesChunked(
    files,
    chatId,
    messageText,
    onProgress,
    onFileProgress,
  );
}
