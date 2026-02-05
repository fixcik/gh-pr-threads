import { describe, it, expect } from 'vitest';
import { shortId } from './shortId.js';

describe('shortId', () => {
  const expectValidShortId = (value: string) => {
    expect(value).toHaveLength(6);
    expect(value).toMatch(/^[a-f0-9]{6}$/);
  };

  it('should generate a 6-character hash from input', () => {
    const result = shortId('test-id-123');

    expectValidShortId(result);
  });

  it('should be deterministic - same input produces same output', () => {
    const input = 'consistent-id';
    const result1 = shortId(input);
    const result2 = shortId(input);

    expect(result1).toBe(result2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = shortId('input-1');
    const hash2 = shortId('input-2');

    expect(hash1).not.toBe(hash2);
  });

  // Test various inputs produce valid 6-char hex hashes
  it.each([
    { input: '', description: 'empty string' },
    { input: 'a'.repeat(1000), description: 'long string (1000 chars)' },
    { input: 'test@#$%^&*()', description: 'special characters' },
    { input: '🎉🚀✨', description: 'emojis' },
    { input: '\n\t\r', description: 'whitespace characters' }
  ])('should handle $description', ({ input }) => {
    const result = shortId(input);

    expectValidShortId(result);
  });

  it('should produce specific known hash for known input', () => {
    // This ensures the hash algorithm stays consistent
    const result = shortId('test');

    expect(result).toBe('9f86d0');
  });
});
