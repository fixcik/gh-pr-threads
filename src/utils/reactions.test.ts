import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  formatReaction,
  supportsEmoji,
  normalizeReaction,
  REACTION_EMOJI,
  VALID_REACTIONS
} from './reactions.js';

describe('reactions utilities', () => {
  describe('formatReaction', () => {
    it('should return emoji when useEmoji is true', () => {
      expect(formatReaction('THUMBS_UP', true)).toBe('👍');
      expect(formatReaction('HEART', true)).toBe('❤️');
    });

    it('should return text when useEmoji is false', () => {
      expect(formatReaction('THUMBS_UP', false)).toBe('THUMBS_UP');
      expect(formatReaction('HEART', false)).toBe('HEART');
    });

    it('should fallback to content for unknown reactions', () => {
      expect(formatReaction('UNKNOWN', true)).toBe('UNKNOWN');
    });
  });

  describe('supportsEmoji', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return true for UTF-8 locale', () => {
      process.env.LANG = 'en_US.UTF-8';
      expect(supportsEmoji()).toBe(true);
    });

    it('should return true for 256color terminal', () => {
      process.env.TERM = 'xterm-256color';
      expect(supportsEmoji()).toBe(true);
    });

    it('should return true on macOS', () => {
      const platform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(supportsEmoji()).toBe(true);
      if (platform) Object.defineProperty(process, 'platform', platform);
    });

    it('should return false without UTF-8 or 256color', () => {
      process.env.LANG = 'C';
      process.env.TERM = 'xterm';
      const platform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(supportsEmoji()).toBe(false);
      if (platform) Object.defineProperty(process, 'platform', platform);
    });
  });

  describe('normalizeReaction', () => {
    it('should accept uppercase reaction names', () => {
      expect(normalizeReaction('THUMBS_UP')).toBe('THUMBS_UP');
      expect(normalizeReaction('HEART')).toBe('HEART');
    });

    it('should convert lowercase to uppercase', () => {
      expect(normalizeReaction('thumbs_up')).toBe('THUMBS_UP');
      expect(normalizeReaction('heart')).toBe('HEART');
    });

    it('should convert emoji to reaction name', () => {
      expect(normalizeReaction('👍')).toBe('THUMBS_UP');
      expect(normalizeReaction('❤️')).toBe('HEART');
      expect(normalizeReaction('🚀')).toBe('ROCKET');
    });

    it('should throw error for invalid reactions', () => {
      expect(() => normalizeReaction('INVALID')).toThrow('Invalid reaction: INVALID');
      expect(() => normalizeReaction('🦄')).toThrow('Invalid reaction: 🦄');
    });

    it('should trim whitespace from input', () => {
      expect(normalizeReaction('  THUMBS_UP  ')).toBe('THUMBS_UP');
      expect(normalizeReaction(' 👍 ')).toBe('THUMBS_UP');
      expect(normalizeReaction('\tthumbs_up\n')).toBe('THUMBS_UP');
    });
  });

  describe('REACTION_EMOJI constant', () => {
    it('should contain all 8 GitHub reactions', () => {
      expect(Object.keys(REACTION_EMOJI)).toHaveLength(8);
      expect(REACTION_EMOJI.THUMBS_UP).toBe('👍');
      expect(REACTION_EMOJI.THUMBS_DOWN).toBe('👎');
      expect(REACTION_EMOJI.LAUGH).toBe('😄');
      expect(REACTION_EMOJI.HOORAY).toBe('🎉');
      expect(REACTION_EMOJI.CONFUSED).toBe('😕');
      expect(REACTION_EMOJI.HEART).toBe('❤️');
      expect(REACTION_EMOJI.ROCKET).toBe('🚀');
      expect(REACTION_EMOJI.EYES).toBe('👀');
    });
  });

  describe('VALID_REACTIONS constant', () => {
    it('should contain all 8 valid reaction names', () => {
      expect(VALID_REACTIONS).toHaveLength(8);
      expect(VALID_REACTIONS).toContain('THUMBS_UP');
      expect(VALID_REACTIONS).toContain('HEART');
    });
  });
});
