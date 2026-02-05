import { DEFAULT_BOT_USERNAMES } from './constants.js';

/**
 * Checks if an author is a bot based on GraphQL type or known bot usernames
 */
export function isBot(author: { login: string; __typename?: string }): boolean {
  // 1. Check by GraphQL __typename field (most reliable)
  if (author.__typename === 'Bot') {
    return true;
  }

  // 2. Check against known bot usernames
  return author.login ? DEFAULT_BOT_USERNAMES.includes(author.login.toLowerCase()) : false;
}
