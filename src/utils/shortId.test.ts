import { describe, it, expect } from 'vitest';
import { shortId } from './shortId.js';

describe('shortId', () => {
  it('should generate a 6-character hash from input', () => {
    const result = shortId('test-id-123');

    expect(result).toHaveLength(6);
    expect(result).toMatch(/^[a-f0-9]{6}$/);
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

  it('should handle empty string', () => {
    const result = shortId('');

    expect(result).toHaveLength(6);
    expect(result).toMatch(/^[a-f0-9]{6}$/);
  });

  it('should handle long strings', () => {
    const longString = 'a'.repeat(1000);
    const result = shortId(longString);

    expect(result).toHaveLength(6);
    expect(result).toMatch(/^[a-f0-9]{6}$/);
  });

  it('should handle special characters', () => {
    const result = shortId('test@#$%^&*()');

    expect(result).toHaveLength(6);
    expect(result).toMatch(/^[a-f0-9]{6}$/);
  });

  it('should produce specific known hash for known input', () => {
    // This ensures the hash algorithm stays consistent
    const result = shortId('test');

    expect(result).toBe('9f86d0');
  });
});
