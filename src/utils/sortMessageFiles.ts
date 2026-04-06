import type { File, Message } from '@/types';

export function sortMessageFilesOldToNew(
  files: File[] | undefined | null,
): File[] | undefined {
  if (files == null || files.length <= 1) return files ?? undefined;
  return [...files].sort((a, b) => {
    const aid = Number(a.id);
    const bid = Number(b.id);
    const aOk = Number.isFinite(aid);
    const bOk = Number.isFinite(bid);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;
    return aid - bid;
  });
}

function filesAlreadyOldToNew(files: File[]): boolean {
  for (let i = 1; i < files.length; i++) {
    const prev = Number(files[i - 1].id);
    const cur = Number(files[i].id);
    if (Number.isFinite(prev) && Number.isFinite(cur) && cur < prev) {
      return false;
    }
  }
  return true;
}

export function normalizeMessageFilesOrder<M extends Message>(message: M): M {
  const f = message.files;
  if (!f || f.length <= 1) return message;
  if (filesAlreadyOldToNew(f)) return message;
  return { ...message, files: sortMessageFilesOldToNew(f)! };
}

export function normalizeMessagesFilesOrder<M extends Message>(
  messages: M[],
): M[] {
  let changed = false;
  const next = messages.map((m) => {
    const n = normalizeMessageFilesOrder(m);
    if (n !== m) changed = true;
    return n;
  });
  return changed ? next : messages;
}
