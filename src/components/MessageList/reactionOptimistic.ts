import { MESSAGE_REACTION_OPTIONS } from '@/constants/messageReactions';
import type { Message } from '@/types';

const reactionEmojiMap = new Map<string, string>(
  MESSAGE_REACTION_OPTIONS.map((reaction) => [reaction.type, reaction.emoji]),
);

const getUserReactions = (message: Message): string[] =>
  message.user_reactions ??
  (message.user_reaction ? [message.user_reaction] : []);

const MAX_USER_REACTIONS = 3;

export const buildOptimisticReactionUpdate = (
  message: Message,
  reactionType: string,
): Pick<Message, 'user_reactions' | 'user_reaction' | 'reactions_summary'> => {
  const currentUserReactions = getUserReactions(message);
  const hasReaction = currentUserReactions.includes(reactionType);
  let removedOldestType: string | null = null;
  const nextUserReactions = hasReaction
    ? currentUserReactions.filter((type) => type !== reactionType)
    : (() => {
        // Keep user_reactions as newest-first:
        // adding a new reaction puts it to the front; overflow evicts the tail.
        if (currentUserReactions.length < MAX_USER_REACTIONS) {
          return [reactionType, ...currentUserReactions];
        }
        removedOldestType =
          currentUserReactions[currentUserReactions.length - 1] ?? null;
        return [reactionType, ...currentUserReactions.slice(0, -1)];
      })();

  const summaryMap = new Map(
    (message.reactions_summary ?? []).map((item) => [item.type, { ...item }]),
  );
  const existing = summaryMap.get(reactionType);

  if (removedOldestType && removedOldestType !== reactionType) {
    const oldest = summaryMap.get(removedOldestType);
    if (oldest) {
      const nextCount = Math.max(0, oldest.count - 1);
      if (nextCount === 0) summaryMap.delete(removedOldestType);
      else summaryMap.set(removedOldestType, { ...oldest, count: nextCount });
    }
  }

  if (hasReaction) {
    if (existing) {
      const nextCount = Math.max(0, existing.count - 1);
      if (nextCount === 0) summaryMap.delete(reactionType);
      else summaryMap.set(reactionType, { ...existing, count: nextCount });
    }
  } else {
    if (existing) {
      summaryMap.set(reactionType, { ...existing, count: existing.count + 1 });
    } else {
      summaryMap.set(reactionType, {
        type: reactionType,
        emoji: reactionEmojiMap.get(reactionType) ?? '✨',
        count: 1,
      });
    }
  }

  return {
    user_reactions: nextUserReactions,
    user_reaction: nextUserReactions[0] ?? null,
    reactions_summary: Array.from(summaryMap.values()),
  };
};
