import type { ProcessedThread, BotSummary, UserComment, Nitpick } from '../types.js';
import { shortId } from '../utils/shortId.js';

const useColors = process.stdout.isTTY;

const colors = {
  bold: (s: string) => useColors ? `\x1b[1m${s}\x1b[0m` : s,
  dim: (s: string) => useColors ? `\x1b[2m${s}\x1b[0m` : s,
  cyan: (s: string) => useColors ? `\x1b[36m${s}\x1b[0m` : s,
  yellow: (s: string) => useColors ? `\x1b[33m${s}\x1b[0m` : s,
  underline: (s: string) => useColors ? `\x1b[4m${s}\x1b[0m` : s,
  reset: '\x1b[0m'
};

interface FileGroup {
  path: string;
  line: number | null;
  items: Array<{
    type: 'thread' | 'nitpick' | 'userComment';
    data: ProcessedThread | Nitpick | UserComment;
  }>;
}

function truncate(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength) + '...';
}

function formatThread(thread: ProcessedThread, indent: string): string {
  const lines: string[] = [];

  thread.comments.forEach((comment, i) => {
    const prefix = i === 0 ? '' : '  ↳ ';
    const firstLine = truncate(comment.body.split('\n')[0], 100);
    const authorLine = `${indent}${prefix}${colors.cyan(comment.author)}: ${firstLine}`;
    lines.push(authorLine);
    lines.push(`${indent}    ${colors.underline(comment.url)}`);
  });

  lines.push(`${indent}    ${colors.dim(`id: ${shortId(thread.thread_id)}`)}`);

  if (thread.status) {
    lines.push(`${indent}    ${colors.yellow(`[${thread.status}]`)}`);
  }

  return lines.join('\n');
}

function formatNitpick(nitpick: Nitpick, indent: string): string {
  const lines: string[] = [];
  const firstLine = truncate(nitpick.content.split('\n')[0], 100);

  lines.push(`${indent}${colors.cyan('coderabbitai')} ${colors.dim('[nitpick]')}: ${firstLine}`);
  lines.push(`${indent}  ${colors.dim(`id: ${shortId(nitpick.id)}`)}`);

  if (nitpick.status) {
    lines.push(`${indent}  ${colors.yellow(`[${nitpick.status}]`)}`);
  }

  return lines.join('\n');
}

function formatUserComment(comment: UserComment, indent: string): string {
  const lines: string[] = [];
  const firstLine = truncate(comment.body.split('\n')[0], 100);

  lines.push(`${indent}${colors.cyan(comment.author)}: ${firstLine}`);
  lines.push(`${indent}  ${colors.underline(comment.url)}`);
  lines.push(`${indent}  ${colors.dim(`id: ${shortId(comment.id)}`)}`);

  return lines.join('\n');
}

function groupByFile(
  threads: ProcessedThread[],
  nitpicks: Nitpick[],
  userComments: UserComment[]
): FileGroup[] {
  const groups = new Map<string, FileGroup>();

  // Add threads
  threads.forEach((thread) => {
    const key = `${thread.path}:${thread.line || 0}`;
    if (!groups.has(key)) {
      groups.set(key, {
        path: thread.path,
        line: thread.line,
        items: []
      });
    }
    groups.get(key)!.items.push({ type: 'thread', data: thread });
  });

  // Add nitpicks
  nitpicks.forEach((nitpick) => {
    const line = parseInt(nitpick.line, 10) || 0;
    const key = `${nitpick.path}:${line}`;
    if (!groups.has(key)) {
      groups.set(key, {
        path: nitpick.path,
        line: line || null,
        items: []
      });
    }
    groups.get(key)!.items.push({ type: 'nitpick', data: nitpick });
  });

  // Add user comments
  userComments.forEach((comment) => {
    const key = `${comment.file}:${comment.line || 0}`;
    if (!groups.has(key)) {
      groups.set(key, {
        path: comment.file,
        line: comment.line,
        items: []
      });
    }
    groups.get(key)!.items.push({ type: 'userComment', data: comment });
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return (a.line || 0) - (b.line || 0);
  });
}

export function formatPlainOutput(
  prMeta: any,
  statePath: string,
  processedThreads: ProcessedThread[],
  botSummaries: BotSummary[],
  userComments: UserComment[],
  allThreads: any[],
  filter: (key: string) => boolean
): string {
  const lines: string[] = [];

  // Header
  const headerLine = `═══ PR #${prMeta.number}: ${prMeta.title} ═══`;
  lines.push(colors.bold(headerLine));
  lines.push(`Status: ${prMeta.state} | Author: ${prMeta.author} | Files: ${prMeta.files.length}`);
  lines.push('');

  // Extract nitpicks from bot summaries
  const allNitpicks: Nitpick[] = [];
  botSummaries.forEach((summary) => {
    if (summary.nitpicks) {
      allNitpicks.push(...summary.nitpicks);
    }
  });

  // Group by file
  const fileGroups = groupByFile(
    filter('threads') ? processedThreads : [],
    filter('nitpicks') ? allNitpicks : [],
    filter('userComments') ? userComments : []
  );

  // Output each file group
  fileGroups.forEach((group, idx) => {
    if (idx > 0) lines.push('');

    const separator = '─'.repeat(40);
    lines.push(separator);

    const locationStr = group.line !== null ? `${group.path}:${group.line}` : group.path;
    lines.push(`📁 ${colors.bold(locationStr)}`);
    lines.push(separator);
    lines.push('');

    group.items.forEach((item, itemIdx) => {
      if (itemIdx > 0) lines.push('');

      if (item.type === 'thread') {
        lines.push(formatThread(item.data as ProcessedThread, '  '));
      } else if (item.type === 'nitpick') {
        lines.push(formatNitpick(item.data as Nitpick, '  '));
      } else if (item.type === 'userComment') {
        lines.push(formatUserComment(item.data as UserComment, '  '));
      }
    });
  });

  // Summary
  lines.push('');
  const unresolvedCount = allThreads.filter((t: any) => !t.isResolved).length;
  const nitpicksCount = allNitpicks.length;
  const summaryLine = `═══ Summary: ${processedThreads.length} threads, ${nitpicksCount} nitpicks, ${unresolvedCount} unresolved ═══`;
  lines.push(colors.bold(summaryLine));

  return lines.join('\n');
}
