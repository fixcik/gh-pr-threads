import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runMarkCommand } from './mark.js';
import type { BatchCommandContext, BatchResult } from './shared.js';

// Mock shared utilities
vi.mock('./shared.js', async () => {
  const actual = await vi.importActual<typeof import('./shared.js')>('./shared.js');
  return {
    ...actual,
    prepareBatchCommandContext: vi.fn(),
    markBatchAndSave: vi.fn(),
    clearBatchAndSave: vi.fn(),
    reportBatchResults: vi.fn()
  };
});

// Import mocked functions after mocking
import {
  prepareBatchCommandContext,
  markBatchAndSave,
  clearBatchAndSave,
  reportBatchResults
} from './shared.js';

describe('runMarkCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Mark as done', () => {
    it('should mark single item as done', () => {
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

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(true);

      runMarkCommand(['abc123'], 'done');

      expect(prepareBatchCommandContext).toHaveBeenCalledWith(['abc123'], undefined);
      expect(markBatchAndSave).toHaveBeenCalledWith(mockContext, ['abc123'], 'done', undefined);
      expect(reportBatchResults).toHaveBeenCalledWith(mockResult, 'Mark as done', []);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('State saved'));
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should mark multiple items as done', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: {
            'abc123': 'PRRT_thread1',
            'def456': 'PRRT_thread2',
            'ghi789': 'src/file.ts:10'
          }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([
          ['abc123', 'PRRT_thread1'],
          ['def456', 'PRRT_thread2'],
          ['ghi789', 'src/file.ts:10']
        ]),
        invalidIds: []
      };

      const mockResult: BatchResult = {
        successful: ['abc123', 'def456', 'ghi789'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(true);

      runMarkCommand(['abc123', 'def456', 'ghi789'], 'done');

      expect(markBatchAndSave).toHaveBeenCalledWith(
        mockContext,
        ['abc123', 'def456', 'ghi789'],
        'done',
        undefined
      );
      expect(reportBatchResults).toHaveBeenCalledWith(mockResult, 'Mark as done', []);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('State saved'));
    });

    it('should mark item with note', () => {
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

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(true);

      runMarkCommand(['abc123'], 'done', 'Test note');

      expect(markBatchAndSave).toHaveBeenCalledWith(mockContext, ['abc123'], 'done', 'Test note');
    });
  });

  describe('Mark as skip', () => {
    it('should mark items as skip', () => {
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

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(true);

      runMarkCommand(['abc123'], 'skip');

      expect(markBatchAndSave).toHaveBeenCalledWith(mockContext, ['abc123'], 'skip', undefined);
      expect(reportBatchResults).toHaveBeenCalledWith(mockResult, 'Mark as skip', []);
    });
  });

  describe('Mark as later', () => {
    it('should mark items as later', () => {
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

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(true);

      runMarkCommand(['abc123'], 'later');

      expect(markBatchAndSave).toHaveBeenCalledWith(mockContext, ['abc123'], 'later', undefined);
      expect(reportBatchResults).toHaveBeenCalledWith(mockResult, 'Mark as later', []);
    });
  });

  describe('Clear mark', () => {
    it('should clear mark from items', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: { 'PRRT_thread1': { status: 'done' } },
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(clearBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(true);

      runMarkCommand(['abc123'], 'clear');

      expect(clearBatchAndSave).toHaveBeenCalledWith(mockContext, ['abc123']);
      expect(markBatchAndSave).not.toHaveBeenCalled();
      expect(reportBatchResults).toHaveBeenCalledWith(mockResult, 'Clear mark', []);
    });

    it('should clear marks from multiple items', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {
            'PRRT_thread1': { status: 'done' },
            'PRRT_thread2': { status: 'skip' }
          },
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

      const mockResult: BatchResult = {
        successful: ['abc123', 'def456'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(clearBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(true);

      runMarkCommand(['abc123', 'def456'], 'clear');

      expect(clearBatchAndSave).toHaveBeenCalledWith(mockContext, ['abc123', 'def456']);
    });
  });

  describe('Invalid IDs handling', () => {
    it('should exit with error when all IDs are invalid', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: {}
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map(),
        invalidIds: ['abc123', 'def456']
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);

      // Mock process.exit to throw an error to stop execution
      processExitSpy.mockImplementation((code) => {
        throw new Error(`Process exit with code ${code}`);
      });

      expect(() => runMarkCommand(['abc123', 'def456'], 'done')).toThrow('Process exit with code 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('None of the provided IDs were found in state')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('abc123: Not found'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('def456: Not found'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should proceed with valid IDs and report invalid ones', () => {
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
        invalidIds: ['invalid']
      };

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(false); // Has invalid IDs

      runMarkCommand(['abc123', 'invalid'], 'done');

      expect(markBatchAndSave).toHaveBeenCalledWith(mockContext, ['abc123'], 'done', undefined);
      expect(reportBatchResults).toHaveBeenCalledWith(mockResult, 'Mark as done', ['invalid']);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Partial failures', () => {
    it('should exit with error code when some items fail', () => {
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

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: [{ id: 'def456', error: 'Some error' }]
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(false);

      runMarkCommand(['abc123', 'def456'], 'done');

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should still save state when some items succeed', () => {
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

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: [{ id: 'def456', error: 'Some error' }]
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(false);

      runMarkCommand(['abc123', 'def456'], 'done');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('State saved'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
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

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(true);

      const prOptions = {
        pr: 'https://github.com/owner/repo/pull/123'
      };

      runMarkCommand(['abc123'], 'done', undefined, prOptions);

      expect(prepareBatchCommandContext).toHaveBeenCalledWith(['abc123'], prOptions);
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

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(true);

      const prOptions = {
        owner: 'testowner',
        repo: 'testrepo',
        number: 123
      };

      runMarkCommand(['abc123'], 'done', undefined, prOptions);

      expect(prepareBatchCommandContext).toHaveBeenCalledWith(['abc123'], prOptions);
    });
  });

  describe('No successful items', () => {
    it('should not show state saved message when no items were successful', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: {},
          nitpicks: {},
          idMap: {}
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map(),
        invalidIds: ['abc123']
      };

      const mockResult: BatchResult = {
        successful: [],
        failed: [{ id: 'abc123', error: 'Not found' }]
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(false);

      // This should fail early due to no resolved IDs
      runMarkCommand(['abc123'], 'done');

      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('State saved'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Operation label generation', () => {
    it('should use correct operation label for done status', () => {
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

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(markBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(true);

      runMarkCommand(['abc123'], 'done');

      expect(reportBatchResults).toHaveBeenCalledWith(mockResult, 'Mark as done', []);
    });

    it('should use "Clear mark" label for clear status', () => {
      const mockContext: BatchCommandContext = {
        state: {
          pr: 'test-pr',
          updatedAt: '2024-01-01',
          threads: { 'PRRT_thread1': { status: 'done' } },
          nitpicks: {},
          idMap: { 'abc123': 'PRRT_thread1' }
        },
        statePath: '/path/to/state.json',
        resolvedIds: new Map([['abc123', 'PRRT_thread1']]),
        invalidIds: []
      };

      const mockResult: BatchResult = {
        successful: ['abc123'],
        failed: []
      };

      vi.mocked(prepareBatchCommandContext).mockReturnValue(mockContext);
      vi.mocked(clearBatchAndSave).mockReturnValue(mockResult);
      vi.mocked(reportBatchResults).mockReturnValue(true);

      runMarkCommand(['abc123'], 'clear');

      expect(reportBatchResults).toHaveBeenCalledWith(mockResult, 'Clear mark', []);
    });
  });
});