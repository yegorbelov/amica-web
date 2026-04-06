import type { Chat, Message } from '@/types';

const DB_NAME = 'amica-chat-state';
const STORE_NAME = 'state';
const LAYOUT_STORE_NAME = 'layout';
const CHATS_SIDEBAR_WIDTH_KEY = 'chatsSidebarWidth';
const CHATS_SIDEBAR_WIDTH_SESSION_KEY = 'amica-chats-sidebar-width';
const CHATS_SIDEBAR_STORED_MIN_PX = 80;
const CHATS_SIDEBAR_STORED_MAX_PX = 500;
const DB_VERSION = 2;

export function clampChatsSidebarWidthForStorage(widthPx: number): number {
  return Math.min(
    CHATS_SIDEBAR_STORED_MAX_PX,
    Math.max(CHATS_SIDEBAR_STORED_MIN_PX, Math.round(widthPx)),
  );
}

export function readChatsSidebarWidthFromSessionStorageSync(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CHATS_SIDEBAR_WIDTH_SESSION_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return clampChatsSidebarWidthForStorage(n);
  } catch {
    return null;
  }
}

export function writeChatsSidebarWidthToSessionStorageSync(
  widthPx: number,
): void {
  if (typeof window === 'undefined' || !Number.isFinite(widthPx)) return;
  try {
    sessionStorage.setItem(
      CHATS_SIDEBAR_WIDTH_SESSION_KEY,
      String(clampChatsSidebarWidthForStorage(widthPx)),
    );
  } catch {
    /* ignore quota / private mode */
  }
}
const LAST_USER_ID_KEY = 'amica-last-user-id';
/** Max messages per chat to store in IDB (last N); keeps size small */
const MAX_MESSAGES_PER_CHAT = 100;

export function getLastUserId(): number | null {
  try {
    const raw = localStorage.getItem(LAST_USER_ID_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function setLastUserId(userId: number): void {
  try {
    if (userId > 0) {
      localStorage.setItem(LAST_USER_ID_KEY, String(userId));
    } else {
      localStorage.removeItem(LAST_USER_ID_KEY);
    }
  } catch {
    localStorage.removeItem(LAST_USER_ID_KEY);
  }
}

export interface ChatStateSnapshot {
  chats: Chat[];
  selectedChatId: number | null;
  messagesCache?: Record<number, Message[]>;
  savedAt: string;
}

/** Trim cache to last N messages per chat for storage. */
export function trimMessagesCacheForStorage(
  cache: Record<number, Message[]>,
  maxPerChat = MAX_MESSAGES_PER_CHAT,
): Record<number, Message[]> {
  return Object.fromEntries(
    Object.entries(cache).map(([k, list]) => [
      k,
      list.length <= maxPerChat ? list : list.slice(-maxPerChat),
    ]),
  );
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
      if (oldVersion < 1) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
      if (oldVersion < 2 && !db.objectStoreNames.contains(LAYOUT_STORE_NAME)) {
        db.createObjectStore(LAYOUT_STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

type ChatsSidebarWidthRow = { key: string; widthPx: number };

export async function getChatsSidebarWidthFromIdb(): Promise<number | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(LAYOUT_STORE_NAME)) {
      db.close();
      resolve(null);
      return;
    }
    const req = db
      .transaction(LAYOUT_STORE_NAME, 'readonly')
      .objectStore(LAYOUT_STORE_NAME)
      .get(CHATS_SIDEBAR_WIDTH_KEY);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      const row = req.result as ChatsSidebarWidthRow | undefined;
      const w = row?.widthPx;
      resolve(typeof w === 'number' && Number.isFinite(w) ? w : null);
    };
  });
}

export async function setChatsSidebarWidthInIdb(
  widthPx: number,
): Promise<void> {
  if (!Number.isFinite(widthPx)) return;
  const clamped = clampChatsSidebarWidthForStorage(widthPx);
  writeChatsSidebarWidthToSessionStorageSync(clamped);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = db
      .transaction(LAYOUT_STORE_NAME, 'readwrite')
      .objectStore(LAYOUT_STORE_NAME);
    const req = store.put({
      key: CHATS_SIDEBAR_WIDTH_KEY,
      widthPx: clamped,
    } satisfies ChatsSidebarWidthRow);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      resolve();
    };
  });
}

function getStore(db: IDBDatabase, mode: IDBTransactionMode = 'readonly') {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

export async function getChatState(
  userId: number,
): Promise<ChatStateSnapshot | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = getStore(db).get(userId);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      const row = req.result as
        | { userId: number; data: ChatStateSnapshot }
        | undefined;
      resolve(row?.data ?? null);
    };
  });
}

export async function setChatState(
  userId: number,
  snapshot: ChatStateSnapshot,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = getStore(db, 'readwrite');
    const payload = {
      userId,
      data: {
        chats: snapshot.chats,
        selectedChatId: snapshot.selectedChatId,
        messagesCache: trimMessagesCacheForStorage(
          snapshot.messagesCache ?? {},
        ),
        savedAt: new Date().toISOString(),
      },
    };
    const req = store.put(payload);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      setLastUserId(userId);
      resolve();
    };
  });
}

export async function deleteChatState(userId: number): Promise<void> {
  if (!userId || !Number.isFinite(userId)) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = getStore(db, 'readwrite');
    const req = store.delete(userId);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      resolve();
    };
  });
}
