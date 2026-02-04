import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import {
  getStatePath,
  loadState,
  saveState,
  clearState,
  registerIds,
  resolveId,
  markItem,
  clearMark,
  markResolved
} from './manager.js';
import type { State, ProcessedThread, Nitpick } from '../types.js';

// Mock fs module
vi.mock('fs');

describe('getStatePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = '/home/testuser';
  });

  it('should create directory path based on owner, repo, and PR number', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = getStatePath('owner', 'repo', 123);

    expect(result).toBe('/home/testuser/.cursor/reviews/owner-repo-123/pr-state.json');
  });

  it('should create directory if it does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);

    getStatePath('owner', 'repo', 456);

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      '/home/testuser/.cursor/reviews/owner-repo-456',
      { recursive: true }
    );
  });

  it('should not create directory if it already exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    getStatePath('owner', 'repo', 789);

    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
});

describe('loadState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load existing state from file', () => {
    const mockState = {
      pr: 'test-pr',
      updatedAt: '2024-01-01',
      threads: { 'thread-1': { status: 'done' as const } },
      nitpicks: { 'nit-1': { status: 'skip' as const } },
      idMap: { 'abc123': 'thread-1' }
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockState));

    const result = loadState('/path/to/state.json');

    expect(result).toEqual(mockState);
  });

  it('should return empty state when file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = loadState('/path/to/state.json');

    expect(result).toEqual({
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    });
  });

  it('should add idMap if missing (backward compatibility)', () => {
    const mockStateWithoutIdMap = {
      pr: 'test-pr',
      updatedAt: '2024-01-01',
      threads: {},
      nitpicks: {}
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStateWithoutIdMap));

    const result = loadState('/path/to/state.json');

    expect(result.idMap).toEqual({});
  });

  it('should return empty state on parse error', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

    const result = loadState('/path/to/state.json');

    expect(result).toEqual({
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    });
  });
});

describe('saveState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save state to file with pretty formatting', () => {
    const state: State = {
      pr: 'test-pr',
      updatedAt: '2024-01-01',
      threads: { 'thread-1': { status: 'done' } },
      nitpicks: {},
      idMap: {}
    };

    saveState('/path/to/state.json', state);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/path/to/state.json',
      JSON.stringify(state, null, 2),
      'utf8'
    );
  });
});

describe('clearState', () => {
  it('should clear all threads, nitpicks, and idMap', () => {
    const state: State = {
      pr: 'test-pr',
      updatedAt: '2024-01-01',
      threads: { 'thread-1': { status: 'done' } },
      nitpicks: { 'nit-1': { status: 'skip' } },
      idMap: { 'abc123': 'thread-1' }
    };

    clearState(state);

    expect(state.threads).toEqual({});
    expect(state.nitpicks).toEqual({});
    expect(state.idMap).toEqual({});
    // pr and updatedAt should remain unchanged
    expect(state.pr).toBe('test-pr');
    expect(state.updatedAt).toBe('2024-01-01');
  });
});

describe('registerIds', () => {
  it('should register thread short IDs to full IDs', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    const threads: ProcessedThread[] = [
      {
        thread_id: 'PRRT_abc123',
        comments: [],
        status: undefined,
        isResolved: false,
        isOutdated: false,
        path: 'test.ts',
        line: null
      }
    ];

    registerIds(state, threads, []);

    // shortId('PRRT_abc123') should produce a 6-char hash
    const keys = Object.keys(state.idMap);
    expect(keys.length).toBe(1);
    expect(keys[0]).toHaveLength(6);
    expect(state.idMap[keys[0]]).toBe('PRRT_abc123');
  });

  it('should register nitpick short IDs to full IDs', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    const nitpicks: Nitpick[] = [
      { id: 'src/index.ts:42', path: 'src/index.ts', line: '42', content: 'test' }
    ];

    registerIds(state, [], nitpicks);

    const keys = Object.keys(state.idMap);
    expect(keys.length).toBe(1);
    expect(keys[0]).toHaveLength(6);
    expect(state.idMap[keys[0]]).toBe('src/index.ts:42');
  });

  it('should register both threads and nitpicks', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    const threads: ProcessedThread[] = [
      {
        thread_id: 'PRRT_thread1',
        comments: [],
        status: undefined,
        isResolved: false,
        isOutdated: false,
        path: 'test.ts',
        line: null
      }
    ];

    const nitpicks: Nitpick[] = [
      { id: 'file.ts:10', path: 'file.ts', line: '10', content: 'test' }
    ];

    registerIds(state, threads, nitpicks);

    expect(Object.keys(state.idMap).length).toBe(2);
  });
});

describe('resolveId', () => {
  it('should return full ID when input is already full (>6 chars)', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    const result = resolveId(state, 'PRRT_abc123456');

    expect(result).toBe('PRRT_abc123456');
  });

  it('should resolve short ID to full ID from idMap', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: { 'abc123': 'PRRT_full_id' }
    };

    const result = resolveId(state, 'abc123');

    expect(result).toBe('PRRT_full_id');
  });

  it('should return undefined when short ID not found in idMap', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    const result = resolveId(state, 'xyz789');

    expect(result).toBeUndefined();
  });
});

describe('markItem', () => {
  it('should mark thread by full ID', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    const success = markItem(state, 'PRRT_thread123', 'done', 'fixed');

    expect(success).toBe(true);
    expect(state.threads['PRRT_thread123']).toEqual({
      status: 'done',
      note: 'fixed'
    });
  });

  it('should mark thread by short ID', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: { 'abc123': 'PRRT_thread456' }
    };

    const success = markItem(state, 'abc123', 'skip');

    expect(success).toBe(true);
    expect(state.threads['PRRT_thread456']).toEqual({
      status: 'skip',
      note: undefined
    });
  });

  it('should mark nitpick by full ID', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    const success = markItem(state, 'src/index.ts:42', 'later', 'will fix');

    expect(success).toBe(true);
    expect(state.nitpicks['src/index.ts:42']).toEqual({
      status: 'later',
      note: 'will fix'
    });
  });

  it('should mark nitpick by short ID', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: { 'def456': 'file.ts:10' }
    };

    const success = markItem(state, 'def456', 'done');

    expect(success).toBe(true);
    expect(state.nitpicks['file.ts:10']).toEqual({
      status: 'done',
      note: undefined
    });
  });

  it('should return false when short ID cannot be resolved', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    // Use a 6-char or less ID that's not in idMap
    const success = markItem(state, 'abc123', 'done');

    expect(success).toBe(false);
  });

  it('should mark item with comments/ in ID as thread', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    const success = markItem(state, 'https://github.com/owner/repo/pull/1/comments/123', 'done');

    expect(success).toBe(true);
    expect(state.threads['https://github.com/owner/repo/pull/1/comments/123']).toBeDefined();
    expect(state.nitpicks['https://github.com/owner/repo/pull/1/comments/123']).toBeUndefined();
  });
});

describe('clearMark', () => {
  it('should clear mark from thread by full ID', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: { 'PRRT_thread123': { status: 'done' } },
      nitpicks: {},
      idMap: {}
    };

    const success = clearMark(state, 'PRRT_thread123');

    expect(success).toBe(true);
    expect(state.threads['PRRT_thread123']).toBeUndefined();
  });

  it('should clear mark from nitpick by short ID', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: { 'file.ts:10': { status: 'skip' } },
      idMap: { 'abc123': 'file.ts:10' }
    };

    const success = clearMark(state, 'abc123');

    expect(success).toBe(true);
    expect(state.nitpicks['file.ts:10']).toBeUndefined();
  });

  it('should return false when short ID cannot be resolved', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    // Use a 6-char or less ID that's not in idMap
    const success = clearMark(state, 'xyz789');

    expect(success).toBe(false);
  });

  it('should remove from both threads and nitpicks collections', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: { 'item-id': { status: 'done' } },
      nitpicks: { 'item-id': { status: 'skip' } },
      idMap: { 'abc123': 'item-id' }
    };

    clearMark(state, 'abc123');

    expect(state.threads['item-id']).toBeUndefined();
    expect(state.nitpicks['item-id']).toBeUndefined();
  });
});

describe('markResolved (deprecated)', () => {
  it('should work as alias to markItem', () => {
    const state: State = {
      pr: '',
      updatedAt: '',
      threads: {},
      nitpicks: {},
      idMap: {}
    };

    const success = markResolved(state, 'PRRT_test', 'done', 'resolved');

    expect(success).toBe(true);
    expect(state.threads['PRRT_test']).toEqual({
      status: 'done',
      note: 'resolved'
    });
  });
});
