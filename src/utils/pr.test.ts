import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectPR, parsePRInfo } from './pr.js';
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

    expect(() => detectPR()).toThrow(/Could not detect PR.*Please provide a PR URL or use --owner, --repo, --number options/);
  });

  it('should throw error when not in a git repository', () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      throw new Error('not a git repository');
    });

    expect(() => detectPR()).toThrow(/Could not detect PR.*Please provide a PR URL or use --owner, --repo, --number options/);
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

describe('parsePRInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse PR info from URL', () => {
    const result = parsePRInfo('https://github.com/owner/repo/pull/42');
    expect(result).toEqual({ owner: 'owner', repo: 'repo', number: 42 });
  });

  it('should use owner/repo/number options', () => {
    const result = parsePRInfo(undefined, { owner: 'o', repo: 'r', number: 1 });
    expect(result).toEqual({ owner: 'o', repo: 'r', number: 1 });
  });

  it('should prefer URL over options when both provided', () => {
    const result = parsePRInfo(
      'https://github.com/url-owner/url-repo/pull/99',
      { owner: 'opt-owner', repo: 'opt-repo', number: 1 }
    );
    expect(result).toEqual({ owner: 'url-owner', repo: 'url-repo', number: 99 });
  });

  it('should fall back to auto-detect when no args', () => {
    const mockOutput = JSON.stringify({
      number: 10,
      url: 'https://github.com/a/b/pull/10'
    });
    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from(mockOutput));

    const result = parsePRInfo();
    expect(result).toEqual({ owner: 'a', repo: 'b', number: 10 });
  });

  it('should fall back to auto-detect when partial options provided', () => {
    const mockOutput = JSON.stringify({
      number: 10,
      url: 'https://github.com/a/b/pull/10'
    });
    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from(mockOutput));

    const result = parsePRInfo(undefined, { owner: 'partial' });
    expect(result).toEqual({ owner: 'a', repo: 'b', number: 10 });
  });

  it('should throw when auto-detect fails and no URL/options', () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      throw new Error('not a git repository');
    });
    expect(() => parsePRInfo()).toThrow(/Could not detect PR/);
  });

  it('should throw on invalid URL', () => {
    expect(() => parsePRInfo('https://example.com/not-github')).toThrow(/Invalid PR URL/);
  });
});
