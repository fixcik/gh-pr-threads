import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeReaction } from '../utils/reactions.js';
import { runReactCommand } from './react.js';
import type { AddReactionMutationData } from '../github/apiTypes.js';
import type { BatchCommandContext } from './shared.js';

// Mock dependencies
vi.mock('../github/client.js');
vi.mock('./shared.js', async () => {
  const actual = await vi.importActual<typeof import('./shared.js')>('./shared.js');
  return {
    ...actual,
    prepareBatchCommandContext: vi.fn(),
    validateBatchContext: vi.fn(),
    reportBatchResults: vi.fn()
  };
});

// Import mocked functions after mocking
import { runGhMutation } from '../github/client.js';
import {
  prepareBatchCommandContext,
  validateBatchContext,
  reportBatchResults
} from './shared.js';

describe('normalizeReaction', () => {
  it('should normalize reaction input', () => {
    expect(normalizeReaction('THUMBS_UP')).toBe('THUMBS_UP');
    expect(normalizeReaction('👍')).toBe('THUMBS_UP');
  });

  it('should validate invalid reaction types', () => {
    expect(() => normalizeReaction('INVALID')).toThrow('Invalid reaction');
  });
});

describe('runReactCommand', () => {
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

  it('should successfully add reaction to a single comment', () => {
    const mockContext: BatchCommandContext = {
      state: {
        pr: 'test-pr',
        updatedAt: '2024-01-01',
        threads: {},
        nitpicks: {},
        idMap: { 'abc123': 'IC_comment1' }
      },
      statePath: '/path/to/state.json',
      resolvedIds: new Map([['abc123', 'IC_comment1']]),
      invalidIds: []
    };

    vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
    vi.mocked(validateBatchContext).mockImplementation(() => {});
    vi.mocked(reportBatchResults).mockReturnValue(true);

    const mockMutationResult: AddReactionMutationData = {
      addReaction: {
        reaction: {
          id: 'reaction_id_1',
          content: 'THUMBS_UP'
        },
        subject: {
          id: 'IC_comment1'
        }
      }
    };

    vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

    runReactCommand(['abc123'], '👍');

    expect(runGhMutation).toHaveBeenCalledWith(
      expect.stringContaining('mutation'),
      {
        subjectId: 'IC_comment1',
        content: 'THUMBS_UP'
      }
    );
    expect(reportBatchResults).toHaveBeenCalledWith(
      { successful: ['abc123'], failed: [] },
      'React',
      [],
      []
    );
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should handle batch operations for multiple comments', () => {
    const mockContext: BatchCommandContext = {
      state: {
        pr: 'test-pr',
        updatedAt: '2024-01-01',
        threads: {},
        nitpicks: {},
        idMap: {
          'abc123': 'IC_comment1',
          'def456': 'IC_comment2',
          'ghi789': 'IC_comment3'
        }
      },
      statePath: '/path/to/state.json',
      resolvedIds: new Map([
        ['abc123', 'IC_comment1'],
        ['def456', 'IC_comment2'],
        ['ghi789', 'IC_comment3']
      ]),
      invalidIds: []
    };

    vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
    vi.mocked(validateBatchContext).mockImplementation(() => {});
    vi.mocked(reportBatchResults).mockReturnValue(true);

    const mockMutationResult: AddReactionMutationData = {
      addReaction: {
        reaction: {
          id: 'reaction_id',
          content: 'HEART'
        },
        subject: {
          id: 'IC_comment1'
        }
      }
    };

    vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

    runReactCommand(['abc123', 'def456', 'ghi789'], '❤️');

    expect(runGhMutation).toHaveBeenCalledTimes(3);
    expect(reportBatchResults).toHaveBeenCalledWith(
      { successful: ['abc123', 'def456', 'ghi789'], failed: [] },
      'React',
      [],
      []
    );
  });

  it('should handle "already reacted" error with friendly message', () => {
    const mockContext: BatchCommandContext = {
      state: {
        pr: 'test-pr',
        updatedAt: '2024-01-01',
        threads: {},
        nitpicks: {},
        idMap: { 'abc123': 'IC_comment1' }
      },
      statePath: '/path/to/state.json',
      resolvedIds: new Map([['abc123', 'IC_comment1']]),
      invalidIds: []
    };

    vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
    vi.mocked(validateBatchContext).mockImplementation(() => {});
    vi.mocked(reportBatchResults).mockReturnValue(false);

    vi.mocked(runGhMutation).mockImplementation(() => {
      throw new Error('GraphQL mutation failed: Subject already reacted');
    });

    runReactCommand(['abc123'], '👍');

    expect(reportBatchResults).toHaveBeenCalledWith(
      {
        successful: [],
        failed: [{ id: 'abc123', error: 'You have already reacted with this emoji' }]
      },
      'React',
      [],
      []
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle "not found" error with friendly message', () => {
    const mockContext: BatchCommandContext = {
      state: {
        pr: 'test-pr',
        updatedAt: '2024-01-01',
        threads: {},
        nitpicks: {},
        idMap: { 'abc123': 'IC_comment1' }
      },
      statePath: '/path/to/state.json',
      resolvedIds: new Map([['abc123', 'IC_comment1']]),
      invalidIds: []
    };

    vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
    vi.mocked(validateBatchContext).mockImplementation(() => {});
    vi.mocked(reportBatchResults).mockReturnValue(false);

    vi.mocked(runGhMutation).mockImplementation(() => {
      throw new Error('GraphQL mutation failed: Not Found');
    });

    runReactCommand(['abc123'], '👍');

    expect(reportBatchResults).toHaveBeenCalledWith(
      {
        successful: [],
        failed: [{ id: 'abc123', error: "Comment not found or you don't have access" }]
      },
      'React',
      [],
      []
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle generic errors', () => {
    const mockContext: BatchCommandContext = {
      state: {
        pr: 'test-pr',
        updatedAt: '2024-01-01',
        threads: {},
        nitpicks: {},
        idMap: { 'abc123': 'IC_comment1' }
      },
      statePath: '/path/to/state.json',
      resolvedIds: new Map([['abc123', 'IC_comment1']]),
      invalidIds: []
    };

    vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
    vi.mocked(validateBatchContext).mockImplementation(() => {});
    vi.mocked(reportBatchResults).mockReturnValue(false);

    vi.mocked(runGhMutation).mockImplementation(() => {
      throw new Error('Network timeout');
    });

    runReactCommand(['abc123'], '👍');

    expect(reportBatchResults).toHaveBeenCalledWith(
      {
        successful: [],
        failed: [{ id: 'abc123', error: 'Network timeout' }]
      },
      'React',
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
          'abc123': 'IC_comment1',
          'def456': 'IC_comment2',
          'ghi789': 'IC_comment3'
        }
      },
      statePath: '/path/to/state.json',
      resolvedIds: new Map([
        ['abc123', 'IC_comment1'],
        ['def456', 'IC_comment2'],
        ['ghi789', 'IC_comment3']
      ]),
      invalidIds: []
    };

    vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
    vi.mocked(validateBatchContext).mockImplementation(() => {});
    vi.mocked(reportBatchResults).mockReturnValue(false);

    const mockMutationResult: AddReactionMutationData = {
      addReaction: {
        reaction: {
          id: 'reaction_id',
          content: 'THUMBS_UP'
        },
        subject: {
          id: 'IC_comment1'
        }
      }
    };

    vi.mocked(runGhMutation)
      .mockReturnValueOnce(mockMutationResult) // First succeeds
      .mockImplementationOnce(() => {
        throw new Error('already reacted'); // Second fails
      })
      .mockReturnValueOnce(mockMutationResult); // Third succeeds

    runReactCommand(['abc123', 'def456', 'ghi789'], '👍');

    expect(runGhMutation).toHaveBeenCalledTimes(3);
    expect(reportBatchResults).toHaveBeenCalledWith(
      {
        successful: ['abc123', 'ghi789'],
        failed: [{ id: 'def456', error: 'You have already reacted with this emoji' }]
      },
      'React',
      [],
      []
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should normalize reaction input before sending', () => {
    const mockContext: BatchCommandContext = {
      state: {
        pr: 'test-pr',
        updatedAt: '2024-01-01',
        threads: {},
        nitpicks: {},
        idMap: { 'abc123': 'IC_comment1' }
      },
      statePath: '/path/to/state.json',
      resolvedIds: new Map([['abc123', 'IC_comment1']]),
      invalidIds: []
    };

    vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
    vi.mocked(validateBatchContext).mockImplementation(() => {});
    vi.mocked(reportBatchResults).mockReturnValue(true);

    const mockMutationResult: AddReactionMutationData = {
      addReaction: {
        reaction: {
          id: 'reaction_id',
          content: 'ROCKET'
        },
        subject: {
          id: 'IC_comment1'
        }
      }
    };

    vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

    // Test with emoji input
    runReactCommand(['abc123'], '🚀');

    expect(runGhMutation).toHaveBeenCalledWith(
      expect.any(String),
      {
        subjectId: 'IC_comment1',
        content: 'ROCKET'
      }
    );
  });

  it('should exit with code 1 when reportBatchResults returns false', () => {
    const mockContext: BatchCommandContext = {
      state: {
        pr: 'test-pr',
        updatedAt: '2024-01-01',
        threads: {},
        nitpicks: {},
        idMap: { 'abc123': 'IC_comment1' }
      },
      statePath: '/path/to/state.json',
      resolvedIds: new Map([['abc123', 'IC_comment1']]),
      invalidIds: []
    };

    vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
    vi.mocked(validateBatchContext).mockImplementation(() => {});
    vi.mocked(reportBatchResults).mockReturnValue(false); // Simulate failure

    const mockMutationResult: AddReactionMutationData = {
      addReaction: {
        reaction: {
          id: 'reaction_id',
          content: 'THUMBS_UP'
        },
        subject: {
          id: 'IC_comment1'
        }
      }
    };

    vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

    runReactCommand(['abc123'], '👍');

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should log reaction ID when present in response', () => {
    const mockContext: BatchCommandContext = {
      state: {
        pr: 'test-pr',
        updatedAt: '2024-01-01',
        threads: {},
        nitpicks: {},
        idMap: { 'abc123': 'IC_comment1' }
      },
      statePath: '/path/to/state.json',
      resolvedIds: new Map([['abc123', 'IC_comment1']]),
      invalidIds: []
    };

    vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
    vi.mocked(validateBatchContext).mockImplementation(() => {});
    vi.mocked(reportBatchResults).mockReturnValue(true);

    const mockMutationResult: AddReactionMutationData = {
      addReaction: {
        reaction: {
          id: 'reaction_xyz_123',
          content: 'THUMBS_UP'
        },
        subject: {
          id: 'IC_comment1'
        }
      }
    };

    vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

    runReactCommand(['abc123'], '👍');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Reaction ID: reaction_xyz_123')
    );
  });

  it('should handle missing addReaction in mutation response', () => {
    const mockContext: BatchCommandContext = {
      state: {
        pr: 'test-pr',
        updatedAt: '2024-01-01',
        threads: {},
        nitpicks: {},
        idMap: { 'abc123': 'IC_comment1' }
      },
      statePath: '/path/to/state.json',
      resolvedIds: new Map([['abc123', 'IC_comment1']]),
      invalidIds: []
    };

    vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
    vi.mocked(validateBatchContext).mockImplementation(() => {});
    vi.mocked(reportBatchResults).mockReturnValue(true);

    // Response with undefined addReaction
    const mockMutationResult: AddReactionMutationData = {
      addReaction: undefined
    };

    vi.mocked(runGhMutation).mockReturnValue(mockMutationResult);

    runReactCommand(['abc123'], '👍');

    expect(reportBatchResults).toHaveBeenCalledWith(
      { successful: ['abc123'], failed: [] },
      'React',
      [],
      []
    );
    // Should not log reaction ID
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Reaction ID:')
    );
  });
});
