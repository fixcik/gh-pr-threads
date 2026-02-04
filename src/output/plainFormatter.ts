import type { ProcessedThread, BotSummary, Nitpick } from '../types.js';
import { shortId } from '../utils/shortId.js';
import { highlight } from 'cli-highlight';

const useColors = process.stdout.isTTY;
const terminalWidth = process.stdout.columns || 120;

const colors = {
  bold: (s: string) => useColors ? `\x1b[1m${s}\x1b[0m` : s,
  dim: (s: string) => useColors ? `\x1b[2m${s}\x1b[0m` : s,
  italic: (s: string) => useColors ? `\x1b[3m${s}\x1b[0m` : s,
  cyan: (s: string) => useColors ? `\x1b[36m${s}\x1b[0m` : s,
  yellow: (s: string) => useColors ? `\x1b[33m${s}\x1b[0m` : s,
  green: (s: string) => useColors ? `\x1b[32m${s}\x1b[0m` : s,
  red: (s: string) => useColors ? `\x1b[31m${s}\x1b[0m` : s,
  underline: (s: string) => useColors ? `\x1b[4m${s}\x1b[0m` : s,
  reset: '\x1b[0m'
};

interface FileGroup {
  path: string;
  line: number | null;
  items: Array<{
    type: 'thread' | 'nitpick';
    data: ProcessedThread | Nitpick;
  }>;
}

/**
 * Удаляет ANSI escape коды для подсчета видимой длины строки
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Переносит текст с учетом ширины терминала и отступов
 */
function wrapText(text: string, indent: string, maxWidth: number = terminalWidth): string[] {
  const lines: string[] = [];
  const indentLength = stripAnsi(indent).length;
  const availableWidth = maxWidth - indentLength;

  // Split into paragraphs (empty line = new paragraph)
  const paragraphs = text.split(/\n\n+/);

  paragraphs.forEach((para, paraIdx) => {
    if (paraIdx > 0) lines.push(''); // Empty line between paragraphs

    const paraLines = para.split('\n');

    paraLines.forEach(line => {
      if (stripAnsi(line).length <= availableWidth) {
        lines.push(indent + line);
        return;
      }

      // Need wrapping
      const words = line.split(' ');
      let currentLine = '';

      words.forEach(word => {
        const testLine = currentLine ? currentLine + ' ' + word : word;

        if (stripAnsi(testLine).length <= availableWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(indent + currentLine);
          }
          currentLine = word;
        }
      });

      if (currentLine) {
        lines.push(indent + currentLine);
      }
    });
  });

  return lines;
}

/**
 * Formats markdown text (bold, italic, inline code)
 */
function formatMarkdown(text: string): string {
  // Inline code: `code`
  text = text.replace(/`([^`]+)`/g, (_, code) => colors.yellow(code));

  // Bold: **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, (_, content) => colors.bold(content));

  // Italic: *text* or _text_ (but not inside words)
  text = text.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, (_, content) => colors.italic(content));
  text = text.replace(/(?<!\w)_([^_]+)_(?!\w)/g, (_, content) => colors.italic(content));

  return text;
}

/**
 * Formats diff block with syntax highlighting
 */
function formatDiffBlock(code: string, indent: string): string[] {
  const lines: string[] = [];

  code.split('\n').forEach(line => {
    if (line.startsWith('+')) {
      // Added line - green
      lines.push(`${indent}      ${colors.green(line)}`);
    } else if (line.startsWith('-')) {
      // Removed line - red
      lines.push(`${indent}      ${colors.red(line)}`);
    } else if (line.startsWith('@@')) {
      // Hunk header - cyan
      lines.push(`${indent}      ${colors.cyan(line)}`);
    } else {
      // Context - normal
      lines.push(`${indent}      ${colors.dim(line)}`);
    }
  });

  return lines;
}

/**
 * Parses and formats HTML <details> blocks
 */
function parseDetailsBlocks(text: string): { text: string; details: Array<{ summary: string; content: string }> } {
  const details: Array<{ summary: string; content: string }> = [];

  // Find all <details> blocks
  const detailsRegex = /<details>\s*<summary>(.*?)<\/summary>\s*([\s\S]*?)<\/details>/gi;

  let match;
  while ((match = detailsRegex.exec(text)) !== null) {
    const summary = match[1].trim();
    const content = match[2].trim();
    details.push({ summary, content });
  }

  // Remove <details> blocks from text
  const cleanText = text.replace(detailsRegex, '').trim();

  return { text: cleanText, details };
}

/**
 * Formats a suggestion block with syntax highlighting
 */
function formatSuggestionBlock(code: string, restText: string, indent: string): string[] {
  const lines: string[] = [];
  lines.push(`${indent}    ${colors.green('suggestion:')}`);

  try {
    const highlighted = useColors
      ? highlight(code, { language: 'typescript', ignoreIllegals: true })
      : code;
    highlighted.split('\n').forEach(line => {
      lines.push(`${indent}      ${line}`);
    });
  } catch {
    code.split('\n').forEach(line => {
      lines.push(`${indent}      ${colors.dim(line)}`);
    });
  }

  if (restText) {
    lines.push('');
    const formatted = formatMarkdown(restText);
    lines.push(...wrapText(formatted, `${indent}    `));
  }

  return lines;
}

/**
 * Formats main content (handles diff blocks or plain markdown)
 */
function formatMainContent(text: string, indent: string): string[] {
  const diffMatch = text.match(/```diff\n([\s\S]*?)```/);
  if (!diffMatch) {
    const formatted = formatMarkdown(text);
    return wrapText(formatted, `${indent}    `);
  }

  const lines: string[] = [];
  const code = diffMatch[1];
  const restText = text.replace(/```diff\n[\s\S]*?```/, '').trim();

  if (restText) {
    const formatted = formatMarkdown(restText);
    lines.push(...wrapText(formatted, `${indent}    `));
    lines.push('');
  }

  lines.push(...formatDiffBlock(code, indent));
  return lines;
}

/**
 * Formats comment body:
 * - Shows suggestion code with syntax highlighting
 * - Highlights markdown (bold, italic, inline code)
 * - Formats diff blocks with colored highlighting
 * - Outputs <details> blocks as quote with bold header
 * - Wraps long lines according to terminal width
 */
function formatCommentBody(body: string, indent: string): { lines: string[]; hasSuggestion: boolean } {
  const lines: string[] = [];
  const { text: mainText, details } = parseDetailsBlocks(body);
  const suggestionMatch = mainText.match(/```suggestion\n([\s\S]*?)```/);

  let hasSuggestion = false;
  if (suggestionMatch) {
    hasSuggestion = true;
    const code = suggestionMatch[1];
    const restText = mainText.replace(/```suggestion\n[\s\S]*?```/, '').trim();
    lines.push(...formatSuggestionBlock(code, restText, indent));
  } else {
    lines.push(...formatMainContent(mainText, indent));
  }

  // Output <details> blocks as quote (with indent)
  details.forEach(detail => {
    lines.push('');

    // Summary as bold header with indent (with wrapping)
    const summaryFormatted = colors.bold('> ' + detail.summary);
    lines.push(...wrapText(summaryFormatted, `${indent}    `));
    lines.push(`${indent}    >`);

    // Check for diff in details
    const diffMatch = detail.content.match(/```diff\n([\s\S]*?)```/);

    if (diffMatch) {
      const code = diffMatch[1];
      const restText = detail.content.replace(/```diff\n[\s\S]*?```/, '').trim();

      if (restText) {
        const formatted = formatMarkdown(restText);
        lines.push(...wrapText(formatted, `${indent}    > `));
        lines.push(`${indent}    >`);
      }

      // Diff in quote (no wrapping)
      formatDiffBlock(code, indent).forEach(line => {
        lines.push(`${indent}    >` + line.slice(indent.length + 4));
      });
    } else {
      // Plain text in quote with wrapping
      const formatted = formatMarkdown(detail.content);
      lines.push(...wrapText(formatted, `${indent}    > `));
    }
  });

  return { lines, hasSuggestion };
}

function formatThread(thread: ProcessedThread, indent: string, prAuthor: string, filePath: string): string {
  const lines: string[] = [];

  // Thread header with ID and location
  const threadId = shortId(thread.thread_id);
  const location = thread.line !== null ? `${filePath}:${thread.line}` : filePath;
  const header = `💬 ${colors.bold(`[${threadId}]`)} at ${colors.dim(location)}`;
  lines.push(`${indent}${header}`);

  // URL right after header
  if (thread.comments.length > 0) {
    lines.push(`${indent}${colors.underline(thread.comments[0].url)}`);
  }

  if (thread.status) {
    lines.push(`${indent}${colors.yellow(`[${thread.status}]`)}`);
  }

  lines.push('');

  thread.comments.forEach((comment, i) => {
    if (i === 0) {
      // First comment - show full author name
      const authorLine = `${indent}${colors.cyan(comment.author)}:`;
      lines.push(authorLine);
    } else {
      // Reply - show "author" if PR author, otherwise show login
      const authorName = comment.author === prAuthor ? 'author' : comment.author;
      const authorLine = `${indent}  ↳ ${colors.dim(authorName)}:`;
      lines.push(authorLine);
    }

    const { lines: bodyLines } = formatCommentBody(comment.body, indent);
    lines.push(...bodyLines);

    if (i < thread.comments.length - 1) {
      lines.push('');
    }
  });

  return lines.join('\n');
}

function formatNitpick(nitpick: Nitpick, indent: string, filePath: string): string {
  const lines: string[] = [];

  // Nitpick header with ID and location
  const nitpickId = shortId(nitpick.id);
  const line = parseInt(nitpick.line, 10);
  const location = line ? `${filePath}:${line}` : filePath;
  const header = `🤖 ${colors.bold(`[${nitpickId}]`)} at ${colors.dim(location)}`;
  lines.push(`${indent}${header}`);

  if (nitpick.status) {
    lines.push(`${indent}${colors.yellow(`[${nitpick.status}]`)}`);
  }

  lines.push('');

  lines.push(`${indent}${colors.cyan('coderabbitai')} ${colors.dim('[nitpick]')}:`);

  const { lines: bodyLines } = formatCommentBody(nitpick.content, indent);
  lines.push(...bodyLines);

  return lines.join('\n');
}

function groupByFile(
  threads: ProcessedThread[],
  nitpicks: Nitpick[]
): FileGroup[] {
  const groups = new Map<string, FileGroup>();

  // Add threads (group by file only, not by line)
  threads.forEach((thread) => {
    const key = thread.path;
    if (!groups.has(key)) {
      groups.set(key, {
        path: thread.path,
        line: null,
        items: []
      });
    }
    groups.get(key)!.items.push({ type: 'thread', data: thread });
  });

  // Add nitpicks
  nitpicks.forEach((nitpick) => {
    const key = nitpick.path;
    if (!groups.has(key)) {
      groups.set(key, {
        path: nitpick.path,
        line: null,
        items: []
      });
    }
    groups.get(key)!.items.push({ type: 'nitpick', data: nitpick });
  });

  // Sort by path
  const result = Array.from(groups.values()).sort((a, b) => a.path.localeCompare(b.path));

  // Sort items within each group by line
  result.forEach(group => {
    group.items.sort((a, b) => {
      const lineA = a.type === 'thread' ? (a.data as ProcessedThread).line || 0
                  : parseInt((a.data as Nitpick).line, 10) || 0;
      const lineB = b.type === 'thread' ? (b.data as ProcessedThread).line || 0
                  : parseInt((b.data as Nitpick).line, 10) || 0;
      return lineA - lineB;
    });
  });

  return result;
}

export interface FormatPlainOutputOptions {
  prMeta: { number: number; title: string; state: string; author: string; files: unknown[] };
  statePath: string;
  processedThreads: ProcessedThread[];
  botSummaries: BotSummary[];
  allThreads: Array<{ isResolved: boolean }>;
  filter: (key: string) => boolean;
}

export function formatPlainOutput(options: FormatPlainOutputOptions): string {
  const { prMeta, processedThreads, botSummaries, allThreads, filter } = options;
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
    filter('nitpicks') ? allNitpicks : []
  );

  // Output each file group
  fileGroups.forEach((group, idx) => {
    if (idx > 0) lines.push('');

    // Calculate length: emoji (2) + space (1) + path length, minimum 40
    const fileNameLength = Math.max(40, 3 + group.path.length);
    const separator = '─'.repeat(Math.min(fileNameLength, terminalWidth));
    lines.push(separator);
    lines.push(`📁 ${colors.bold(group.path)}`);
    lines.push(separator);
    lines.push('');

    group.items.forEach((item, itemIdx) => {
      if (itemIdx > 0) {
        lines.push('');
        // Item separator: indent (2) + dots, minimum 38
        const itemSeparatorLength = Math.max(38, Math.min(fileNameLength - 2, terminalWidth - 2));
        lines.push(colors.dim('  ' + '·'.repeat(itemSeparatorLength)));
        lines.push('');
      }

      if (item.type === 'thread') {
        lines.push(formatThread(item.data as ProcessedThread, '  ', prMeta.author, group.path));
      } else if (item.type === 'nitpick') {
        lines.push(formatNitpick(item.data as Nitpick, '  ', group.path));
      }
    });
  });

  // Summary
  lines.push('');
  const unresolvedCount = allThreads.filter((t) => !t.isResolved).length;
  const nitpicksCount = allNitpicks.length;
  const summaryLine = `═══ Summary: ${processedThreads.length} threads, ${nitpicksCount} nitpicks, ${unresolvedCount} unresolved ═══`;
  lines.push(colors.bold(summaryLine));

  return lines.join('\n');
}
