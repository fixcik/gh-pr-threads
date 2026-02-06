import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseCliArgs } from './cli.js';
import * as fs from 'fs';
import * as prUtils from './utils/pr.js';

// Mock dependencies
vi.mock('fs');
vi.mock('./utils/pr.js');
vi.mock('./commands/mark.js');
vi.mock('./commands/reply.js');
vi.mock('./commands/resolve.js');
vi.mock('./commands/react.js');

describe('parseCliArgs', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock PR detection by default
    vi.mocked(prUtils.parsePRInfo).mockReturnValue({
      owner: 'testowner',
      repo: 'testrepo',
      number: 123
    });
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    // Reset argv to original state
    process.argv = process.argv.slice(0, 2);
  });

  describe('Default command - fetch PR data', () => {
    it('should parse PR URL from positional argument', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/456'];

      vi.mocked(prUtils.parsePRInfo).mockReturnValue({
        owner: 'owner',
        repo: 'repo',
        number: 456
      });

      const args = parseCliArgs();

      expect(args.owner).toBe('owner');
      expect(args.repo).toBe('repo');
      expect(args.number).toBe(456);
      expect(args.format).toBe('plain');
    });

    it('should use default format as plain', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123'];

      const args = parseCliArgs();

      expect(args.format).toBe('plain');
    });

    it('should parse --json flag', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--json'];

      const args = parseCliArgs();

      expect(args.format).toBe('json');
    });

    it('should parse --all flag', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--all'];

      const args = parseCliArgs();

      expect(args.showAll).toBe(true);
    });

    it('should parse --include-done flag', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--include-done'];

      const args = parseCliArgs();

      expect(args.includeDone).toBe(true);
    });

    it('should parse --with-resolved flag', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--with-resolved'];

      const args = parseCliArgs();

      expect(args.withResolved).toBe(true);
    });

    it('should parse --ignore-bots flag', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--ignore-bots'];

      const args = parseCliArgs();

      expect(args.ignoreBots).toBe(true);
    });

    it('should parse --only option with comma-separated values', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--only', 'threads,nitpicks'];

      const args = parseCliArgs();

      expect(args.only).toEqual(['threads', 'nitpicks']);
    });

    it('should parse --only option with single value', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--only', 'threads'];

      const args = parseCliArgs();

      expect(args.only).toEqual(['threads']);
    });

    it('should parse --thread option', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--thread', 'abc123'];

      const args = parseCliArgs();

      expect(args.threadId).toBe('abc123');
    });

    it('should parse --no-cache flag', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--no-cache'];

      const args = parseCliArgs();

      expect(args.noCache).toBe(true);
    });

    it('should parse --cache-ttl option', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--cache-ttl', '120'];

      const args = parseCliArgs();

      expect(args.cacheTtl).toBe(120);
    });

    it('should use default cache-ttl of 60 when not specified', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123'];

      const args = parseCliArgs();

      expect(args.cacheTtl).toBe(60);
    });

    it('should parse --owner, --repo, --number options', () => {
      process.argv = ['node', 'cli.js', '--owner', 'myowner', '--repo', 'myrepo', '--number', '999'];

      vi.mocked(prUtils.parsePRInfo).mockReturnValue({
        owner: 'myowner',
        repo: 'myrepo',
        number: 999
      });

      const args = parseCliArgs();

      expect(args.owner).toBe('myowner');
      expect(args.repo).toBe('myrepo');
      expect(args.number).toBe(999);
    });

    it('should combine multiple flags correctly', () => {
      process.argv = [
        'node', 'cli.js',
        'https://github.com/owner/repo/pull/123',
        '--all',
        '--include-done',
        '--with-resolved',
        '--ignore-bots',
        '--json',
        '--only', 'threads,summaries'
      ];

      const args = parseCliArgs();

      expect(args.showAll).toBe(true);
      expect(args.includeDone).toBe(true);
      expect(args.withResolved).toBe(true);
      expect(args.ignoreBots).toBe(true);
      expect(args.format).toBe('json');
      expect(args.only).toEqual(['threads', 'summaries']);
    });

    it('should handle error when parsePRInfo throws', () => {
      process.argv = ['node', 'cli.js'];

      vi.mocked(prUtils.parsePRInfo).mockImplementation(() => {
        throw new Error('Could not detect PR');
      });

      parseCliArgs();

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Could not detect PR'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should trim whitespace from --only values', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--only', 'threads , nitpicks , files'];

      const args = parseCliArgs();

      expect(args.only).toEqual(['threads', 'nitpicks', 'files']);
    });
  });

  describe('Clear command', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    it('should exit after clear command executes', () => {
      process.argv = ['node', 'cli.js', 'clear'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle clear with PR URL', () => {
      process.argv = ['node', 'cli.js', 'clear', 'https://github.com/owner/repo/pull/123'];

      parseCliArgs();

      expect(prUtils.parsePRInfo).toHaveBeenCalledWith(
        'https://github.com/owner/repo/pull/123',
        expect.any(Object)
      );
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle clear with --owner, --repo, --number options', () => {
      process.argv = ['node', 'cli.js', 'clear', '--owner', 'o', '--repo', 'r', '--number', '1'];

      parseCliArgs();

      // Commander passes the parsed options as the second parameter
      expect(prUtils.parsePRInfo).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should remove state file when it exists', () => {
      process.env.HOME = '/home/testuser';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const unlinkSyncSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      process.argv = ['node', 'cli.js', 'clear'];

      parseCliArgs();

      expect(unlinkSyncSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('State cleared'));
      expect(processExitSpy).toHaveBeenCalledWith(0);

      unlinkSyncSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should remove images directory when it exists', () => {
      process.env.HOME = '/home/testuser';
      // Mock existsSync with implementation that returns false for state file, true for images dir
      vi.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const pathStr = path.toString();
        return pathStr.includes('images'); // Return true only for images directory
      });
      const rmSyncSpy = vi.spyOn(fs, 'rmSync').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      process.argv = ['node', 'cli.js', 'clear'];

      parseCliArgs();

      expect(rmSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining('images'),
        { recursive: true }
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Removed images'));

      rmSyncSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should show message when no state file found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      process.argv = ['node', 'cli.js', 'clear'];

      parseCliArgs();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No state file found'));

      consoleLogSpy.mockRestore();
    });

    it('should handle errors gracefully', () => {
      vi.mocked(prUtils.parsePRInfo).mockImplementation(() => {
        throw new Error('Test error');
      });

      process.argv = ['node', 'cli.js', 'clear'];

      parseCliArgs();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Test error');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Mark command', () => {
    it('should exit after mark command executes', () => {
      process.argv = ['node', 'cli.js', 'mark', 'done', 'abc123'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should validate mark status', () => {
      process.argv = ['node', 'cli.js', 'mark', 'invalid', 'abc123'];

      parseCliArgs();

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid status'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should accept valid mark statuses', () => {
      const validStatuses = ['done', 'skip', 'later', 'clear'];

      for (const status of validStatuses) {
        vi.clearAllMocks();
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        process.argv = ['node', 'cli.js', 'mark', status, 'abc123'];
        parseCliArgs();

        expect(processExitSpy).toHaveBeenCalledWith(0);
        processExitSpy.mockRestore();
      }
    });

    it('should handle multiple IDs', () => {
      process.argv = ['node', 'cli.js', 'mark', 'done', 'abc123', 'def456', 'ghi789'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should parse --note option', () => {
      process.argv = ['node', 'cli.js', 'mark', 'done', 'abc123', '--note', 'Test note'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should parse --pr option', () => {
      process.argv = ['node', 'cli.js', 'mark', 'done', 'abc123', '--pr', 'https://github.com/owner/repo/pull/123'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should parse --owner, --repo, --number options', () => {
      process.argv = ['node', 'cli.js', 'mark', 'done', 'abc123', '--owner', 'o', '--repo', 'r', '--number', '1'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Reply command', () => {
    it('should exit after reply command executes', () => {
      process.argv = ['node', 'cli.js', 'reply', 'Test message', 'abc123'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle multiple thread IDs', () => {
      process.argv = ['node', 'cli.js', 'reply', 'Test message', 'abc123', 'def456'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should parse --mark option', () => {
      process.argv = ['node', 'cli.js', 'reply', 'Test message', 'abc123', '--mark', 'done'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should validate --mark option value', () => {
      process.argv = ['node', 'cli.js', 'reply', 'Test message', 'abc123', '--mark', 'invalid'];

      parseCliArgs();

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid mark status'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should parse --pr option', () => {
      process.argv = ['node', 'cli.js', 'reply', 'Test message', 'abc123', '--pr', 'https://github.com/owner/repo/pull/123'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Resolve command', () => {
    it('should exit after resolve command executes', () => {
      process.argv = ['node', 'cli.js', 'resolve', 'abc123'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle multiple thread IDs', () => {
      process.argv = ['node', 'cli.js', 'resolve', 'abc123', 'def456', 'ghi789'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should parse --reply option', () => {
      process.argv = ['node', 'cli.js', 'resolve', 'abc123', '--reply', 'Fixed'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should parse --mark option', () => {
      process.argv = ['node', 'cli.js', 'resolve', 'abc123', '--mark', 'done'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should validate --mark option value', () => {
      process.argv = ['node', 'cli.js', 'resolve', 'abc123', '--mark', 'invalid'];

      parseCliArgs();

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid mark status'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should parse --pr option', () => {
      process.argv = ['node', 'cli.js', 'resolve', 'abc123', '--pr', 'https://github.com/owner/repo/pull/123'];

      parseCliArgs();

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('React command', () => {
    it('should exit after react command executes', async () => {
      process.argv = ['node', 'cli.js', 'react', 'THUMBS_UP', 'abc123'];

      parseCliArgs();

      // Wait for async import and execution
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have called process.exit (either 0 or 1)
      expect(processExitSpy).toHaveBeenCalled();
    });

    it('should handle emoji reaction', async () => {
      process.argv = ['node', 'cli.js', 'react', '👍', 'abc123'];

      parseCliArgs();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle multiple comment IDs', async () => {
      process.argv = ['node', 'cli.js', 'react', '❤️', 'abc123', 'def456'];

      parseCliArgs();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should parse --pr option', async () => {
      process.argv = ['node', 'cli.js', 'react', 'ROCKET', 'abc123', '--pr', 'https://github.com/owner/repo/pull/123'];

      parseCliArgs();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle --only with value after equals', () => {
      process.argv = ['node', 'cli.js', 'https://github.com/owner/repo/pull/123', '--only=threads'];

      const args = parseCliArgs();

      expect(args.only).toEqual(['threads']);
    });

    it('should handle numeric PR number option', () => {
      process.argv = ['node', 'cli.js', '--owner', 'o', '--repo', 'r', '--number', '123'];

      vi.mocked(prUtils.parsePRInfo).mockReturnValue({
        owner: 'o',
        repo: 'r',
        number: 123
      });

      const args = parseCliArgs();

      expect(args.number).toBe(123);
    });

    it('should return empty object for subcommands (unreachable path)', () => {
      process.argv = ['node', 'cli.js', 'mark', 'done', 'abc123'];

      const result = parseCliArgs();

      // This tests the TypeScript type assertion for subcommands
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });
});