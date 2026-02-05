import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import {
  prepareBatchCommandContext,
  filterThreadsOnly,
  markBatchAndSave,
  clearBatchAndSave,
  reportBatchResults,
  type BatchResult
} from './shared.js';
import * as prUtils from '../utils/pr.js';
import type { State } from '../types.js';

// Mock fs and pr detection
vi.mock('fs');
vi.mock('../utils/pr.js');

describe('prepareBatchCommandContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = '/home/testuser';

    // Mock PR detection
    vi.mocked(prUtils.detectPR).mockReturnValue({
      owner: 'testowner',
      repo: 'testrepo',
      number: 123
    });

    // Mock fs operations
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should resolve valid short IDs to full IDs', () => {
    const mockState = {
      pr: 'test-pr',
      updatedAt: '2024-01-01',
      threads: {},
      nitpicks: {},
      idMap: {
        'abc123': 'PRRT_thread1',
        'def456': 'PRRT_thread2'
      }
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockState));

    const context = prepareBatchCommandContext(['abc123', 'def456']);

    expect(context.resolvedIds.size).toBe(2);
    expect(context.resolvedIds.get('abc123')).toBe('PRRT_thread1');
    expect(context.resolvedIds.get('def456')).toBe('PRRT_thread2');
    expect(context.invalidIds).toEqual([]);
  });

  it('should collect invalid IDs separately', () => {
    const mockState = {
      pr: 'test-pr',
      updatedAt: '2024-01-01',
      threads: {},
      nitpicks: {},
      idMap: {
        'abc123': 'PRRT_thread1'
      }
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockState));

    // Use 6-char IDs that are not in idMap
    const context = prepareBatchCommandContext(['abc123', 'inv456', 'xyz789']);

    expect(context.resolvedIds.size).toBe(1);
    expect(context.invalidIds).toEqual(['inv456', 'xyz789']);
  });

  it('should handle all invalid IDs', () => {
    const mockState = {
      pr: 'test-pr',
      updatedAt: '2024-01-01',
      threads: {},
      nitpicks: {},
      idMap: {}
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockState));

    // Use 6-char IDs that are not in idMap
    const context = prepareBatchCommandContext(['inval1', 'inval2']);

    expect(context.resolvedIds.size).toBe(0);
    expect(context.invalidIds).toEqual(['inval1', 'inval2']);
  });
});

describe('filterThreadsOnly', () => {
  const emptyState: State = {
    pr: '',
    updatedAt: '',
    threads: {},
    nitpicks: {},
    idMap: {}
  };

  it('should separate threads from nitpicks', () => {
    const context = {
      state: emptyState,
      statePath: '/path/to/state.json',
      resolvedIds: new Map([
        ['abc123', 'PRRT_thread1'],
        ['def456', 'src/file.ts:42'],
        ['ghi789', 'PRRT_thread2']
      ]),
      invalidIds: []
    };

    const { threads, nonThreads } = filterThreadsOnly(context);

    expect(threads.size).toBe(2);
    expect(threads.get('abc123')).toBe('PRRT_thread1');
    expect(threads.get('ghi789')).toBe('PRRT_thread2');
    expect(nonThreads).toEqual(['def456']);
  });

  it('should return empty threads when all are nitpicks', () => {
    const context = {
      state: emptyState,
      statePath: '/path/to/state.json',
      resolvedIds: new Map([
        ['abc123', 'src/file.ts:42'],
        ['def456', 'src/other.ts:10']
      ]),
      invalidIds: []
    };

    const { threads, nonThreads } = filterThreadsOnly(context);

    expect(threads.size).toBe(0);
    expect(nonThreads).toEqual(['abc123', 'def456']);
  });
});

describe('markBatchAndSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mark multiple items and save state once', () => {
    const mockState: State = {
      pr: 'test-pr',
      updatedAt: '2024-01-01',
      threads: {},
      nitpicks: {},
      idMap: {
        'abc123': 'PRRT_thread1',
        'def456': 'PRRT_thread2'
      }
    };

    const context = {
      state: mockState,
      statePath: '/path/to/state.json',
      resolvedIds: new Map([
        ['abc123', 'PRRT_thread1'],
        ['def456', 'PRRT_thread2']
      ]),
      invalidIds: []
    };

    const result = markBatchAndSave(context, ['abc123', 'def456'], 'done', 'batch note');

    expect(result.successful).toEqual(['abc123', 'def456']);
    expect(result.failed).toEqual([]);
    expect(mockState.threads['PRRT_thread1']).toEqual({ status: 'done', note: 'batch note' });
    expect(mockState.threads['PRRT_thread2']).toEqual({ status: 'done', note: 'batch note' });
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  it('should handle partial failures', () => {
    const mockState: State = {
      pr: 'test-pr',
      updatedAt: '2024-01-01',
      threads: {},
      nitpicks: {},
      idMap: {
        'abc123': 'PRRT_thread1'
      }
    };

    const context = {
      state: mockState,
      statePath: '/path/to/state.json',
      resolvedIds: new Map([
        ['abc123', 'PRRT_thread1']
      ]),
      invalidIds: []
    };

    // Try to mark including an ID not in resolvedIds
    const result = markBatchAndSave(context, ['abc123', 'notfound'], 'done');

    expect(result.successful).toEqual(['abc123']);
    expect(result.failed).toEqual([{ id: 'notfound', error: 'Not found in state' }]);
  });

  it('should not save when all fail', () => {
    const mockState: State = {
      pr: 'test-pr',
      updatedAt: '2024-01-01',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    const context = {
      state: mockState,
      statePath: '/path/to/state.json',
      resolvedIds: new Map(),
      invalidIds: []
    };

    const result = markBatchAndSave(context, ['invalid1', 'invalid2'], 'done');

    expect(result.successful).toEqual([]);
    expect(result.failed.length).toBe(2);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});

describe('clearBatchAndSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clear marks for multiple items', () => {
    const mockState: State = {
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
    };

    const context = {
      state: mockState,
      statePath: '/path/to/state.json',
      resolvedIds: new Map([
        ['abc123', 'PRRT_thread1'],
        ['def456', 'PRRT_thread2']
      ]),
      invalidIds: []
    };

    const result = clearBatchAndSave(context, ['abc123', 'def456']);

    expect(result.successful).toEqual(['abc123', 'def456']);
    expect(mockState.threads['PRRT_thread1']).toBeUndefined();
    expect(mockState.threads['PRRT_thread2']).toBeUndefined();
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
  });
});

describe('reportBatchResults', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should return true when all succeed', () => {
    const result: BatchResult = {
      successful: ['abc123', 'def456'],
      failed: []
    };

    const allSucceeded = reportBatchResults(result, 'Mark as done');

    expect(allSucceeded).toBe(true);
  });

  it('should return false when there are failures', () => {
    const result: BatchResult = {
      successful: ['abc123'],
      failed: [{ id: 'def456', error: 'Some error' }]
    };

    const allSucceeded = reportBatchResults(result, 'Mark as done');

    expect(allSucceeded).toBe(false);
  });

  it('should return false when there are invalid IDs', () => {
    const result: BatchResult = {
      successful: ['abc123'],
      failed: []
    };

    const allSucceeded = reportBatchResults(result, 'Mark as done', ['invalid']);

    expect(allSucceeded).toBe(false);
  });

  it('should return false when there are non-thread IDs', () => {
    const result: BatchResult = {
      successful: ['abc123'],
      failed: []
    };

    const allSucceeded = reportBatchResults(result, 'Reply', [], ['nitpick1']);

    expect(allSucceeded).toBe(false);
  });

  it('should show summary for multiple items', () => {
    const result: BatchResult = {
      successful: ['abc123', 'def456'],
      failed: [{ id: 'ghi789', error: 'Error' }]
    };

    reportBatchResults(result, 'Mark as done');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('2/3 succeeded'));
  });
});
