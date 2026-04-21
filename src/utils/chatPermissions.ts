import type { Chat } from '@/types';

/** In channels, only owners and admins may send messages and files. */
export function chatUserCanPost(chat: Chat | null | undefined): boolean {
  if (!chat) return false;
  if (chat.type !== 'C') return true;
  return chat.my_role === 'owner' || chat.my_role === 'admin';
}
