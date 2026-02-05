export const REACTION_EMOJI: Record<string, string> = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  LAUGH: '😄',
  HOORAY: '🎉',
  CONFUSED: '😕',
  HEART: '❤️',
  ROCKET: '🚀',
  EYES: '👀',
};

export const VALID_REACTIONS = [
  'THUMBS_UP', 'THUMBS_DOWN', 'LAUGH', 'HOORAY',
  'CONFUSED', 'HEART', 'ROCKET', 'EYES'
] as const;

export const EMOJI_TO_REACTION: Record<string, string> = {
  '👍': 'THUMBS_UP',
  '👎': 'THUMBS_DOWN',
  '😄': 'LAUGH',
  '🎉': 'HOORAY',
  '😕': 'CONFUSED',
  '❤️': 'HEART',
  '🚀': 'ROCKET',
  '👀': 'EYES',
};

export type ReactionType = typeof VALID_REACTIONS[number];

/**
 * Format reaction content as emoji or text
 */
export function formatReaction(content: string, useEmoji: boolean): string {
  return useEmoji ? REACTION_EMOJI[content] || content : content;
}

/**
 * Detect if terminal supports emoji
 */
export function supportsEmoji(): boolean {
  const term = process.env.TERM || '';
  const lang = process.env.LANG || '';

  return lang.toLowerCase().includes('utf-8') ||
         term.includes('256color') ||
         process.platform === 'darwin';
}

/**
 * Normalize reaction input to valid GitHub reaction type
 * Accepts: THUMBS_UP, thumbs_up, 👍
 */
export function normalizeReaction(input: string): string {
  const upper = input.toUpperCase();
  if (VALID_REACTIONS.includes(upper as ReactionType)) {
    return upper;
  }
  if (EMOJI_TO_REACTION[input]) {
    return EMOJI_TO_REACTION[input];
  }
  throw new Error(`Invalid reaction: ${input}`);
}
