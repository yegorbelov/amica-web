import { apiFetch } from '@/utils/apiFetch';
import type { User, Chat, Message } from '@/types';
import type { GlobalSearchItem } from '@/contexts/search/globalSearchTypes';

export const searchGlobal = async (query: string): Promise<User[]> => {
  const res = await apiFetch(
    `/api/users/search/?email=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error('Search failed');
  return res.json();
};

type GroupSearchRow = {
  id: number;
  name?: string | null;
  type?: 'D' | 'G' | 'C';
  primary_media?: Chat['primary_media'] | null;
  last_message?: Message | null;
  unread_count?: number;
  info?: string | number | null;
  /** From global group search: current user already in this chat */
  is_member?: boolean;
};

export function groupSearchRowToChat(row: GroupSearchRow): Chat {
  const chatType: Chat['type'] =
    row.type === 'C' ? 'C' : row.type === 'D' ? 'D' : 'G';
  return {
    id: row.id,
    name: row.name ?? null,
    type: chatType,
    members: [],
    primary_media: row.primary_media,
    last_message: row.last_message ?? null,
    unread_count: row.unread_count ?? 0,
    info: row.info != null ? String(row.info) : '',
    media: [],
    is_member: row.is_member,
  };
}

export async function searchGlobalGroups(
  query: string,
): Promise<GroupSearchRow[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await apiFetch(`/api/groups/search/?q=${encodeURIComponent(q)}`);
  if (!res.ok) {
    if (res.status === 400) return [];
    throw new Error('Group search failed');
  }
  return res.json() as Promise<GroupSearchRow[]>;
}

export async function joinGroup(chatId: number): Promise<boolean> {
  const res = await apiFetch(`/api/groups/${chatId}/join/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return res.ok;
}

export async function leaveGroup(chatId: number): Promise<boolean> {
  const res = await apiFetch(`/api/groups/${chatId}/leave/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return res.ok;
}

/** Global groups by name + user search (users need query length ≥ 4 on API). */
export const searchChatsTab = async (
  query: string,
): Promise<GlobalSearchItem[]> => {
  const trimmed = query.trim();
  const groupPromise = searchGlobalGroups(trimmed).catch(
    () => [] as GroupSearchRow[],
  );
  const userPromise =
    trimmed.length >= 4
      ? searchGlobal(trimmed).catch(() => [] as User[])
      : Promise.resolve([] as User[]);
  const [groupRows, users] = await Promise.all([groupPromise, userPromise]);
  const groupItems = groupRows.map(
    (row): GlobalSearchItem => ({
      type: 'group',
      data: groupSearchRowToChat(row),
    }),
  );
  const userItems = users.map(
    (user): GlobalSearchItem => ({ type: 'user', data: user }),
  );
  return [...groupItems, ...userItems];
};
