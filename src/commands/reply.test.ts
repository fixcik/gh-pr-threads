import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runReplyCommand } from './reply.js';
import type { AddReplyMutationData } from '../github/apiTypes.js';
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

describe('runReplyCommand', () => {
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

  describe('Basic reply functionality', () => {
    it('should reply to a single thread', () => {
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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

      runReplyCommand(['abc123'], 'Test reply message');

      expect(prepareThreadCommandContext).toHaveBeenCalledWith(['abc123'], undefined);
      expect(runGhMutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation'),
        {
          threadId: 'PRRT_thread1',
          body: 'Test reply message'
        }
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Replied to thread abc123'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://github.com/owner/repo/pull/123#discussion_r1')
      );
      expect(reportBatchResults).toHaveBeenCalledWith(
        { successful: ['abc123'], failed: [] },
        'Reply',
        [],
        []
      );
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should reply to multiple threads', () => {
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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

      runReplyCommand(['abc123', 'def456', 'ghi789'], 'Batch reply message');

      expect(runGhMutation).toHaveBeenCalledTimes(3);
      expect(runGhMutation).toHaveBeenCalledWith(expect.any(String), {
        threadId: 'PRRT_thread1',
        body: 'Batch reply message'
      });
      expect(runGhMutation).toHaveBeenCalledWith(expect.any(String), {
        threadId: 'PRRT_thread2',
        body: 'Batch reply message'
      });
      expect(runGhMutation).toHaveBeenCalledWith(expect.any(String), {
        threadId: 'PRRT_thread3',
        body: 'Batch reply message'
      });
      expect(reportBatchResults).toHaveBeenCalledWith(
        { successful: ['abc123', 'def456', 'ghi789'], failed: [] },
        'Reply',
        [],
        []
      );
    });

    it('should handle reply without comment URL in response', () => {
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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: undefined
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

      runReplyCommand(['abc123'], 'Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Replied to thread abc123'));
      // Should not log URL line
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^\s+https:/));
    });
  });

  describe('Error handling', () => {
    it('should handle reply mutation errors', () => {
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

      runReplyCommand(['abc123'], 'Test message');

      expect(reportBatchResults).toHaveBeenCalledWith(
        {
          successful: [],
          failed: [{ id: 'abc123', error: 'GraphQL mutation failed: Not Found' }]
        },
        'Reply',
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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation)
        .mockReturnValueOnce(mockMutationResult) // First succeeds
        .mockImplementationOnce(() => {
          throw new Error('Network timeout'); // Second fails
        })
        .mockReturnValueOnce(mockMutationResult); // Third succeeds

      runReplyCommand(['abc123', 'def456', 'ghi789'], 'Test message');

      expect(runGhMutation).toHaveBeenCalledTimes(3);
      expect(reportBatchResults).toHaveBeenCalledWith(
        {
          successful: ['abc123', 'ghi789'],
          failed: [{ id: 'def456', error: 'Network timeout' }]
        },
        'Reply',
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

      runReplyCommand(['abc123'], 'Test message');

      expect(reportBatchResults).toHaveBeenCalledWith(
        {
          successful: [],
          failed: [{ id: 'abc123', error: 'String error' }]
        },
        'Reply',
        [],
        []
      );
    });
  });

  describe('Mark after reply', () => {
    it('should mark items as done after successful reply', () => {
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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

      runReplyCommand(['abc123'], 'Test message', 'done');

      expect(markSuccessfulItems).toHaveBeenCalledWith(
        mockContext,
        threads,
        ['abc123'],
        'done'
      );
    });

    it('should mark items as skip after successful reply', () => {
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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

      runReplyCommand(['abc123'], 'Test message', 'skip');

      expect(markSuccessfulItems).toHaveBeenCalledWith(
        mockContext,
        threads,
        ['abc123'],
        'skip'
      );
    });

    it('should mark items as later after successful reply', () => {
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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

      runReplyCommand(['abc123'], 'Test message', 'later');

      expect(markSuccessfulItems).toHaveBeenCalledWith(
        mockContext,
        threads,
        ['abc123'],
        'later'
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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

      runReplyCommand(['abc123'], 'Test message');

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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation)
        .mockReturnValueOnce(mockMutationResult) // First succeeds
        .mockImplementationOnce(() => {
          throw new Error('Failed'); // Second fails
        });

      runReplyCommand(['abc123', 'def456'], 'Test message', 'done');

      expect(markSuccessfulItems).toHaveBeenCalledWith(
        mockContext,
        threads,
        ['abc123'], // Only successful ID
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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

      const prOptions = {
        pr: 'https://github.com/owner/repo/pull/123'
      };

      runReplyCommand(['abc123'], 'Test message', undefined, prOptions);

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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

      const prOptions = {
        owner: 'testowner',
        repo: 'testrepo',
        number: 123
      };

      runReplyCommand(['abc123'], 'Test message', undefined, prOptions);

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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

      runReplyCommand(['abc123', 'nit456'], 'Test message');

      expect(reportBatchResults).toHaveBeenCalledWith(
        { successful: ['abc123'], failed: [] },
        'Reply',
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

      const mockMutationResult: AddReplyMutationData = {
        addPullRequestReviewThreadReply: {
          comment: {
            id: 'IC_comment1',
            url: 'https://github.com/owner/repo/pull/123#discussion_r1'
          }
        }
      };

      vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

      runReplyCommand(['abc123'], 'Test message');

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

      runReplyCommand(['abc123'], 'Test message');

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});