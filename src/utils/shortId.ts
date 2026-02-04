import { createHash } from 'crypto';

/**
 * Generates a short 6-character ID based on SHA256 hash of full ID
 * Deterministic - the same full ID always produces the same short hash
 */
export function shortId(fullId: string): string {
  return createHash('sha256')
    .update(fullId)
    .digest('hex')
    .slice(0, 6);
}
