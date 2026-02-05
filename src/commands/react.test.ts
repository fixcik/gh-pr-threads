import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeReaction } from '../utils/reactions.js';

describe('react command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should normalize reaction input', () => {
    expect(normalizeReaction('THUMBS_UP')).toBe('THUMBS_UP');
    expect(normalizeReaction('👍')).toBe('THUMBS_UP');
  });

  it('should validate invalid reaction types', () => {
    expect(() => normalizeReaction('INVALID')).toThrow('Invalid reaction');
  });

  // Integration tests would require mocking gh CLI
  // We'll test the core logic flow
});
