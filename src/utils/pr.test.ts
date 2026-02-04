import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectPR } from './pr.js';
import * as childProcess from 'child_process';

// Mock child_process module
vi.mock('child_process');

describe('detectPR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect PR from gh CLI output', () => {
    const mockOutput = JSON.stringify({
      number: 123,
      url: 'https://github.com/owner/repo/pull/123'
    });

    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from(mockOutput));

    const result = detectPR();

    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 123
    });
  });

  it('should call gh pr view with correct command', () => {
    const mockOutput = JSON.stringify({
      number: 456,
      url: 'https://github.com/test/project/pull/456'
    });

    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from(mockOutput));

    detectPR();

    expect(childProcess.execSync).toHaveBeenCalledWith(
      'gh pr view --json number,url',
      { encoding: 'utf8' }
    );
  });

  it('should parse different owner and repo names', () => {
    const mockOutput = JSON.stringify({
      number: 789,
      url: 'https://github.com/another-owner/another-repo/pull/789'
    });

    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from(mockOutput));

    const result = detectPR();

    expect(result).toEqual({
      owner: 'another-owner',
      repo: 'another-repo',
      number: 789
    });
  });

  it('should handle PR numbers with multiple digits', () => {
    const mockOutput = JSON.stringify({
      number: 9999,
      url: 'https://github.com/org/project/pull/9999'
    });

    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from(mockOutput));

    const result = detectPR();

    expect(result.number).toBe(9999);
  });

  it('should throw error when gh CLI fails', () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      throw new Error('Command failed');
    });

    expect(() => detectPR()).toThrow(
      'Could not detect PR. Please provide a PR URL or use --owner, --repo, --number options.'
    );
  });

  it('should throw error when not in a git repository', () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      throw new Error('not a git repository');
    });

    expect(() => detectPR()).toThrow(
      'Could not detect PR. Please provide a PR URL or use --owner, --repo, --number options.'
    );
  });

  it('should handle org names with special characters', () => {
    const mockOutput = JSON.stringify({
      number: 42,
      url: 'https://github.com/my-org-123/my-repo_test/pull/42'
    });

    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from(mockOutput));

    const result = detectPR();

    expect(result).toEqual({
      owner: 'my-org-123',
      repo: 'my-repo_test',
      number: 42
    });
  });
});
