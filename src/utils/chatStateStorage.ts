import type { Chat, Message } from '@/types';

const DB_NAME = 'amica-chat-state';
const STORE_NAME = 'state';
const DB_VERSION = 1;

export interface ChatStateSnapshot {
  chats: Chat[];
  selectedChatId: number | null;
  messagesCache: Record<number, Message[]>;
  savedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'userId' });
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
      const row = req.result as { userId: number; data: ChatStateSnapshot } | undefined;
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
        ...snapshot,
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
      resolve();
    };
  });
}
