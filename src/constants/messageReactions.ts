const reactionIconUrl = (name: string) =>
  new URL(`../assets/reactions/icons/${name}.png`, import.meta.url).href;

export const MESSAGE_REACTION_OPTIONS = [
  {
    type: 'like',
    emoji: '👍',
    iconUrl: reactionIconUrl('reaction-like'),
    webmUrl: new URL(
      '../assets/reactions/webm/bubble_burst_confetti.webm',
      import.meta.url,
    ).href,
    movUrl: new URL(
      '../assets/reactions/mov/bubble_burst_confetti.mov',
      import.meta.url,
    ).href,
  },
  {
    type: 'heart',
    emoji: '❤️',
    iconUrl: reactionIconUrl('reaction-heart'),
    webmUrl: new URL(
      '../assets/reactions/webm/love_burst_solid.webm',
      import.meta.url,
    ).href,
    movUrl: new URL(
      '../assets/reactions/mov/love_burst_solid.mov',
      import.meta.url,
    ).href,
  },
  {
    type: 'laugh',
    emoji: '😂',
    iconUrl: reactionIconUrl('reaction-laugh'),
    webmUrl: new URL(
      '../assets/reactions/webm/celebration.webm',
      import.meta.url,
    ).href,
    movUrl: new URL('../assets/reactions/mov/celebration.mov', import.meta.url)
      .href,
  },
  {
    type: 'wow',
    emoji: '😮',
    iconUrl: reactionIconUrl('reaction-wow'),
    webmUrl: new URL('../assets/reactions/webm/fireworks.webm', import.meta.url)
      .href,
    movUrl: new URL('../assets/reactions/mov/fireworks.mov', import.meta.url)
      .href,
  },
  {
    type: 'sad',
    emoji: '😢',
    iconUrl: reactionIconUrl('reaction-sad'),
    webmUrl: new URL('../assets/reactions/webm/confetti.webm', import.meta.url)
      .href,
    movUrl: new URL('../assets/reactions/mov/confetti.mov', import.meta.url)
      .href,
  },
  {
    type: 'fire',
    emoji: '🔥',
    iconUrl: reactionIconUrl('reaction-fire'),
    webmUrl: new URL(
      '../assets/reactions/webm/flex_confetti.webm',
      import.meta.url,
    ).href,
    movUrl: new URL(
      '../assets/reactions/mov/flex_confetti.mov',
      import.meta.url,
    ).href,
  },
] as const;

export type MessageReactionType =
  (typeof MESSAGE_REACTION_OPTIONS)[number]['type'];

export interface MessageReactionSummaryItem {
  type: MessageReactionType | string;
  emoji: string;
  count: number;
}
