import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runResolveCommand } from './resolve.js';
import type { AddReplyMutationData, ResolveMutationData } from '../github/apiTypes.js';
import type { BatchCommandContext } from './shared.js';

// Mock dependencies
vi.mock('../github/client.js');
vi.mock('./shared.js', async () => {
  const actual = await vi.importActual<typeof import('./shared.js')>('./shared.js');
  return {
    ...actual,
    prepareThreadCommandContext: vi.fn(),
    reportBatchResults: vi.fn(),
    markSuccessfulItems: vi.fn()
  };
});

// Import mocked functions after mocking
import { runGhMutation } from '../github/client.js';
import {
  prepareThreadCommandContext,
  reportBatchResults,
  markSuccessfulItems
} from './shared.js';

describe('runResolveCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Basic resolve functionality', () => {
    it('should resolve a single thread', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockResolveMutationResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockResolveMutationResult);

      runResolveCommand(['abc123']);

      expect(prepareThreadCommandContext).toHaveBeenCalledWith(['abc123'], undefined);
      expect(runGhMutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation'),
        { threadId: 'PRRT_thread1' }
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Resolved thread abc123'));
      expect(reportBatchResults).toHaveBeenCalledWith(
        { successful: ['abc123'], failed: [] },
        'Resolve',
        [],
        []
      );
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should resolve multiple threads', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: {
            'abc123': 'PRRT_thread1',
            'def456': 'PRRT_thread2',
            'ghi789': 'PRRT_thread3'
          }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([
          ['abc123', 'PRRT_thread1'],
          ['def456', 'PRRT_thread2'],
          ['ghi789', 'PRRT_thread3']
        ]),
        invalidIds: []
      };

      const threads = new Map([
        ['abc123', 'PRRT_thread1'],
        ['def456', 'PRRT_thread2'],
        ['ghi789', 'PRRT_thread3']
      ]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockResolveMutationResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockResolveMutationResult);

      runResolveCommand(['abc123', 'def456', 'ghi789']);

      expect(runGhMutation).toHaveBeenCalledTimes(3);
      expect(reportBatchResults).toHaveBeenCalledWith(
        { successful: ['abc123', 'def456', 'ghi789'], failed: [] },
        'Resolve',
        [],
        []
      );
    });
  });

  describe('Resolve with reply', () => {
    it('should reply and then resolve thread', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockReplyResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation)
        .mockReturnValueOnce(mockReplyResult)
        .mockReturnValueOnce(mockResolveResult);

      runResolveCommand(['abc123'], 'Fixed in latest commit');

      expect(runGhMutation).toHaveBeenCalledTimes(2);
      expect(runGhMutation).toHaveBeenNthCalledWith(1, expect.any(String), {
        threadId: 'PRRT_thread1',
        body: 'Fixed in latest commit'
      });
      expect(runGhMutation).toHaveBeenNthCalledWith(2, expect.any(String), {
        threadId: 'PRRT_thread1'
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Replied to thread abc123'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Resolved thread abc123'));
    });

    it('should log comment URL when present in reply', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockReplyResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation)
        .mockReturnValueOnce(mockReplyResult)
        .mockReturnValueOnce(mockResolveResult);

      runResolveCommand(['abc123'], 'Fixed');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://github.com/owner/repo/pull/123#discussion_r1')
      );
    });

    it('should not log comment URL when absent in reply', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockReplyResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: undefined
          }
        }
      };

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation)
        .mockReturnValueOnce(mockReplyResult)
        .mockReturnValueOnce(mockResolveResult);

      runResolveCommand(['abc123'], 'Fixed');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Replied to thread abc123'));
      // Should not log URL line
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^\s+https:/));
    });

    it('should apply same reply to multiple threads', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: {
            'abc123': 'PRRT_thread1',
            'def456': 'PRRT_thread2'
          }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([
          ['abc123', 'PRRT_thread1'],
          ['def456', 'PRRT_thread2']
        ]),
        invalidIds: []
      };

      const threads = new Map([
        ['abc123', 'PRRT_thread1'],
        ['def456', 'PRRT_thread2']
      ]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockReplyResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation)
        .mockReturnValueOnce(mockReplyResult)
        .mockReturnValueOnce(mockResolveResult)
        .mockReturnValueOnce(mockReplyResult)
        .mockReturnValueOnce(mockResolveResult);

      runResolveCommand(['abc123', 'def456'], 'Batch reply');

      expect(runGhMutation).toHaveBeenCalledTimes(4);
      expect(runGhMutation).toHaveBeenCalledWith(expect.any(String), {
        threadId: 'PRRT_thread1',
        body: 'Batch reply'
      });
      expect(runGhMutation).toHaveBeenCalledWith(expect.any(String), {
        threadId: 'PRRT_thread2',
        body: 'Batch reply'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle resolve mutation errors', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(false);

      vi.mocked(runGhMutation).mockImplementation(() => {
        throw new Error('GraphQL mutation failed: Not Found');
      });

      runResolveCommand(['abc123']);

      expect(reportBatchResults).toHaveBeenCalledWith(
        {
          successful: [],
          failed: [{ id: 'abc123', error: 'GraphQL mutation failed: Not Found' }]
        },
        'Resolve',
        [],
        []
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail entire operation when reply succeeds but resolve fails', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(false);

      const mockReplyResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation)
        .mockReturnValueOnce(mockReplyResult) // Reply succeeds
        .mockImplementationOnce(() => {
          throw new Error('Resolve failed'); // Resolve fails
        });

      runResolveCommand(['abc123'], 'Fixed');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Replied to thread abc123'));
      expect(reportBatchResults).toHaveBeenCalledWith(
        {
          successful: [],
          failed: [{ id: 'abc123', error: 'Resolve failed' }]
        },
        'Resolve',
        [],
        []
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle partial failures in batch operations', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: {
            'abc123': 'PRRT_thread1',
            'def456': 'PRRT_thread2',
            'ghi789': 'PRRT_thread3'
          }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([
          ['abc123', 'PRRT_thread1'],
          ['def456', 'PRRT_thread2'],
          ['ghi789', 'PRRT_thread3']
        ]),
        invalidIds: []
      };

      const threads = new Map([
        ['abc123', 'PRRT_thread1'],
        ['def456', 'PRRT_thread2'],
        ['ghi789', 'PRRT_thread3']
      ]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(false);

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation)
        .mockReturnValueOnce(mockResolveResult) // First succeeds
        .mockImplementationOnce(() => {
          throw new Error('Network timeout'); // Second fails
        })
        .mockReturnValueOnce(mockResolveResult); // Third succeeds

      runResolveCommand(['abc123', 'def456', 'ghi789']);

      expect(runGhMutation).toHaveBeenCalledTimes(3);
      expect(reportBatchResults).toHaveBeenCalledWith(
        {
          successful: ['abc123', 'ghi789'],
          failed: [{ id: 'def456', error: 'Network timeout' }]
        },
        'Resolve',
        [],
        []
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error exceptions', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(false);

      vi.mocked(runGhMutation).mockImplementation(() => {
        throw 'String error';
      });

      runResolveCommand(['abc123']);

      expect(reportBatchResults).toHaveBeenCalledWith(
        {
          successful: [],
          failed: [{ id: 'abc123', error: 'String error' }]
        },
        'Resolve',
        [],
        []
      );
    });
  });

  describe('Mark after resolve', () => {
    it('should mark items as done after successful resolve', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockResolveResult);

      runResolveCommand(['abc123'], undefined, 'done');

      expect(markSuccessfulItems).toHaveBeenCalledWith(
        mockContext,
        threads,
        ['abc123'],
        'done'
      );
    });

    it('should mark items as skip after successful resolve', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockResolveResult);

      runResolveCommand(['abc123'], undefined, 'skip');

      expect(markSuccessfulItems).toHaveBeenCalledWith(
        mockContext,
        threads,
        ['abc123'],
        'skip'
      );
    });

    it('should not mark items when markAs is undefined', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockResolveResult);

      runResolveCommand(['abc123']);

      expect(markSuccessfulItems).not.toHaveBeenCalled();
    });

    it('should only mark successful items in partial failure scenario', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: {
            'abc123': 'PRRT_thread1',
            'def456': 'PRRT_thread2'
          }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([
          ['abc123', 'PRRT_thread1'],
          ['def456', 'PRRT_thread2']
        ]),
        invalidIds: []
      };

      const threads = new Map([
        ['abc123', 'PRRT_thread1'],
        ['def456', 'PRRT_thread2']
      ]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(false);

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation)
        .mockReturnValueOnce(mockResolveResult) // First succeeds
        .mockImplementationOnce(() => {
          throw new Error('Failed'); // Second fails
        });

      runResolveCommand(['abc123', 'def456'], undefined, 'done');

      expect(markSuccessfulItems).toHaveBeenCalledWith(
        mockContext,
        threads,
        ['abc123'], // Only successful ID
        'done'
      );
    });

    it('should combine reply and mark options', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockReplyResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation)
        .mockReturnValueOnce(mockReplyResult)
        .mockReturnValueOnce(mockResolveResult);

      runResolveCommand(['abc123'], 'Fixed', 'done');

      expect(runGhMutation).toHaveBeenCalledTimes(2);
      expect(markSuccessfulItems).toHaveBeenCalledWith(
        mockContext,
        threads,
        ['abc123'],
        'done'
      );
    });
  });

  describe('PR options', () => {
    it('should pass PR URL to context preparation', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockResolveResult);

      const prOptions = {
        pr: 'https://github.com/owner/repo/pull/123'
      };

      runResolveCommand(['abc123'], undefined, undefined, prOptions);

      expect(prepareThreadCommandContext).toHaveBeenCalledWith(['abc123'], prOptions);
    });

    it('should pass owner/repo/number options to context preparation', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockResolveResult);

      const prOptions = {
        owner: 'testowner',
        repo: 'testrepo',
        number: 123
      };

      runResolveCommand(['abc123'], undefined, undefined, prOptions);

      expect(prepareThreadCommandContext).toHaveBeenCalledWith(['abc123'], prOptions);
    });
  });

  describe('Non-thread IDs handling', () => {
    it('should report non-thread IDs and exit with error', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: {
            'abc123': 'PRRT_thread1',
            'nit456': 'src/file.ts:10'
          }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([
          ['abc123', 'PRRT_thread1'],
          ['nit456', 'src/file.ts:10']
        ]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);
      const nonThreads = ['nit456'];

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads
      });

      vi.mocked(reportBatchResults).mockReturnValue(false);

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockResolveResult);

      runResolveCommand(['abc123', 'nit456']);

      expect(reportBatchResults).toHaveBeenCalledWith(
        { successful: ['abc123'], failed: [] },
        'Resolve',
        [],
        ['nit456']
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Exit behavior', () => {
    it('should not exit when all operations succeed', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(true);

      const mockResolveResult: ResolveMutationData = {
        resolveReviewThread: {
          thread: {
            id: 'PRRT_thread1',
            isResolved: true
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockResolveResult);

      runResolveCommand(['abc123']);

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should exit with code 1 when reportBatchResults returns false', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const threads = new Map([['abc123', 'PRRT_thread1']]);

      vi.mocked(prepareThreadCommandContext).mockReturnValue({
        context: mockContext,
        threads,
        nonThreads: []
      });

      vi.mocked(reportBatchResults).mockReturnValue(false);

      vi.mocked(runGhMutation).mockImplementation(() => {
        throw new Error('Test error');
      });

      runResolveCommand(['abc123']);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});