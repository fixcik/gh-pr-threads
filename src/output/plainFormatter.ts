import type { ProcessedThread, BotSummary, Nitpick, Thread, ReactionGroup } from '../types.js';
import type { PRMetadata } from '../core/dataFetcher.js';
import { shortId } from '../utils/shortId.js';
import { highlight } from 'cli-highlight';
import { loadState } from '../state/manager.js';
import { formatReaction, supportsEmoji } from '../utils/reactions.js';

const useColors = process.stdout.isTTY;

// Dynamic terminal width getter with higher default for separators
function getTerminalWidth(): number {
  return process.stdout.columns || 150;
}

// Use larger default for text wrapping
const terminalWidth = process.stdout.columns || 120;

const colors = {
  bold: (s: string) => useColors ? `\u001b[1m${s}\u001b[0m` : s,
  dim: (s: string) => useColors ? `\u001b[2m${s}\u001b[0m` : s,
  italic: (s: string) => useColors ? `\u001b[3m${s}\u001b[0m` : s,
  cyan: (s: string) => useColors ? `\u001b[36m${s}\u001b[0m` : s,
  yellow: (s: string) => useColors ? `\u001b[33m${s}\u001b[0m` : s,
  green: (s: string) => useColors ? `\u001b[32m${s}\u001b[0m` : s,
  greenBright: (s: string) => useColors ? `\u001b[92m${s}\u001b[0m` : s,
  red: (s: string) => useColors ? `\u001b[31m${s}\u001b[0m` : s,
  underline: (s: string) => useColors ? `\u001b[4m${s}\u001b[0m` : s,
  reset: '\u001b[0m'
};

/**
 * Format reaction groups for plain text output
 */
export function formatReactionGroups(groups: ReactionGroup[], useEmoji: boolean, indent: string = '  '): string {
  if (!groups || groups.length === 0) {
    return '';
  }

  // Filter out reactions with zero count
  const nonEmptyGroups = groups.filter(group => group.reactors.totalCount > 0);

  if (nonEmptyGroups.length === 0) {
    return '';
  }

  return nonEmptyGroups
    .map(group => {
      const icon = formatReaction(group.content, useEmoji);
      const totalCount = group.reactors.totalCount;
      const displayedUsers = group.reactors.nodes.slice(0, 3);
      const remainingCount = totalCount - displayedUsers.length;

      const usersList = displayedUsers.map(r => `@${r.login}`).join(', ');
      const remaining = remainingCount > 0 ? ` and ${remainingCount} more` : '';

      // Match wrapInQuote formatting: indent + 2 spaces + bar + 2 spaces + content
      return `${indent}  │  ${icon} ${usersList}${remaining}`;
    })
    .join('\n');
}

/**
 * Generates a consistent color for a username based on hash
 */
function getUserColor(username: string): (s: string) => string {
  if (!useColors) {
    return (s: string) => s;
  }
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash) + username.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Available ANSI colors (avoiding white and black for readability)
  const colorCodes = [
    31,  // red
    32,  // green
    33,  // yellow
    34,  // blue
    35,  // magenta
    36,  // cyan
    91,  // bright red
    92,  // bright green
    93,  // bright yellow
    94,  // bright blue
    95,  // bright magenta
    96   // bright cyan
  ];
  
  const colorCode = colorCodes[Math.abs(hash) % colorCodes.length];
  
  return (s: string) => `\u001b[${colorCode}m${s}\u001b[0m`;
}

interface FileGroup {
  path: string;
  line: number | null;
  additions: number;
  deletions: number;
  items: Array<{
    type: 'thread' | 'nitpick';
    data: ProcessedThread | Nitpick;
  }>;
}

/**
 * Maps file extension to highlight.js language identifier
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', go: 'go',
    java: 'java', kt: 'kotlin',
    rs: 'rust', c: 'c', cpp: 'cpp',
    yaml: 'yaml', yml: 'yaml', json: 'json',
    md: 'markdown', html: 'html', css: 'css',
    sh: 'bash', bash: 'bash'
  };
  return langMap[ext || ''] || 'plaintext';
}

/**
 * Removes ANSI escape codes to calculate visible string length
 */
function stripAnsi(str: string): string {
  // Use unicode escape for ANSI escape sequence (ESC character)
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Wraps text according to terminal width and indentation
 */
function wrapText(text: string, indent: string, maxWidth: number = terminalWidth, reserveForQuote: boolean = false): string[] {
  const lines: string[] = [];
  const indentLength = stripAnsi(indent).length;
  // Reserve 1 extra char if text will be wrapped in quote bar later
  // because quote bar "  │  " (5 chars) is longer than "    " (4 chars) indent
  const availableWidth = maxWidth - indentLength - (reserveForQuote ? 1 : 0);

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
 * Formats diff block with syntax highlighting and gray quote bar
 */
function formatDiffBlock(code: string, indent: string): string[] {
  const lines: string[] = [];
  const bar = colors.dim('│');

  code.split('\n').forEach(line => {
    let coloredLine: string;
    if (line.startsWith('+')) {
      // Added line - green
      coloredLine = colors.green(line);
    } else if (line.startsWith('-')) {
      // Removed line - red
      coloredLine = colors.red(line);
    } else if (line.startsWith('@@')) {
      // Hunk header - cyan
      coloredLine = colors.cyan(line);
    } else {
      // Context - normal
      coloredLine = colors.dim(line);
    }
    // Trim trailing spaces from code lines
    lines.push(`${indent}    ${bar}  ${coloredLine}`.trimEnd());
  });

  return lines;
}

/**
 * Parses and formats HTML <details> blocks
 */
function parseDetailsBlocks(text: string): { text: string; details: Array<{ summary: string; content: string }> } {
  const details: Array<{ summary: string; content: string }> = [];

  // Find all <details> blocks
  const detailsRegex = /<details>\s*<summary>(.*?)<\/summary>\s*([\s\S]*)<\/details>/gi;

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
/**
 * Formats a suggestion block with syntax highlighting
 */
function formatSuggestionBlock(code: string, restText: string, indent: string, language: string = 'typescript'): string[] {
  const lines: string[] = [];
  const bar = colors.dim('│');

  // Header like GitHub UI
  lines.push(`${indent}    ${colors.bold(colors.cyan('📝 Suggested change'))}`);
  lines.push(`${indent}    ${bar}`);

  // Remove trailing newlines from code
  const cleanCode = code.replace(/\n+$/, '');

  // Show suggestion code with diff-style highlighting and gray quote bar
  try {
    const highlighted = useColors
      ? highlight(cleanCode, { language, ignoreIllegals: true })
      : cleanCode;
    highlighted.split('\n').forEach(line => {
      // Trim trailing spaces from code lines
      lines.push(`${indent}    ${bar}  ${colors.green('+ ')}${line}`.trimEnd());
    });
  } catch {
    cleanCode.split('\n').forEach(line => {
      // Trim trailing spaces from code lines
      lines.push(`${indent}    ${bar}  ${colors.green('+ ')}${colors.dim(line)}`.trimEnd());
    });
  }

  if (restText) {
    lines.push(`${indent}    ${bar}`);
    const formatted = formatMarkdown(restText);
    const textLines = wrapText(formatted, `${indent}    `, terminalWidth, true);
    // Wrap rest text in quote bar too
    textLines.forEach(line => {
      const content = line.replace(new RegExp(`^${indent}    `), '');
      lines.push(`${indent}    ${bar}  ${content}`);
    });
  }

  return lines;
}

/**
 * Formats main content (handles diff blocks or plain markdown)
 */
/**
 * Formats main content (handles diff blocks, code blocks, or plain markdown)
 */
/**
 * Highlights code and wraps it in a gray quote bar
 */
function highlightAndWrapCode(code: string, language: string, indent: string): string[] {
  const lines: string[] = [];
  const codeLines: string[] = [];
  
  // Apply syntax highlighting
  try {
    const highlighted = useColors
      ? highlight(code, { language, ignoreIllegals: true })
      : code;
    highlighted.split('\n').forEach(line => {
      codeLines.push(`${indent}      ${line}`);
    });
  } catch {
    code.split('\n').forEach(line => {
      codeLines.push(`${indent}      ${colors.dim(line)}`);
    });
  }

  // Wrap code block in gray quote bar
  const bar = colors.dim('│');
  codeLines.forEach(line => {
    const content = line.replace(new RegExp(`^${indent}      `), '');
    // Trim trailing spaces from code lines
    lines.push(`${indent}    ${bar}  ${content}`.trimEnd());
  });
  
  return lines;
}

/**
 * Formats main content (handles diff blocks, code blocks, or plain markdown)
 */
function formatMainContent(text: string, indent: string): string[] {
  // Check for diff blocks first
  const diffMatch = text.match(/```diff\n([\s\S]*)```/);
  if (diffMatch) {
    const lines: string[] = [];
    const code = diffMatch[1];
    const restText = text.replace(/```diff\n[\s\S]*```/, '').trim();

    if (restText) {
      const formatted = formatMarkdown(restText);
      lines.push(...wrapText(formatted, `${indent}    `, terminalWidth, true));
      lines.push('');
    }

    lines.push(...formatDiffBlock(code, indent));
    return lines;
  }

  // Check for regular code blocks with ```language
  const codeBlockMatch = text.match(/```([a-z]*)[\s\S]*\n```/);
  if (codeBlockMatch) {
    const lines: string[] = [];
    let language = codeBlockMatch[1] || 'text';
    
    // Map 'suggestion' to 'diff' for proper syntax highlighting
    if (language === 'suggestion') {
      language = 'diff';
    }
    
    const code = text.match(/```[a-z]*\n([\s\S]*)\n```/)?.[1] || '';
    const restText = text.replace(/```[a-z]*\n[\s\S]*\n```/, '').trim();

    if (restText) {
      const formatted = formatMarkdown(restText);
      lines.push(...wrapText(formatted, `${indent}    `, terminalWidth, true));
      lines.push('');
    }

    lines.push(...highlightAndWrapCode(code, language, indent));
    return lines;
  }

  // Plain markdown
  const formatted = formatMarkdown(text);
  return wrapText(formatted, `${indent}    `, terminalWidth, true);
}

/**
 * Formats comment body:
 * - Shows suggestion code with syntax highlighting
 * - Highlights markdown (bold, italic, inline code)
 * - Formats diff blocks with colored highlighting
 * - Outputs <details> blocks as quote with bold header
 * - Wraps long lines according to terminal width
 */
/**
 * Formats comment body:
 * - Shows suggestion code with syntax highlighting
 * - Highlights markdown (bold, italic, inline code)
 * - Formats diff blocks with colored highlighting
 * - Outputs <details> blocks as quote with bold header
 * - Wraps long lines according to terminal width
 */
/**
 * Formats a diff block inside a details section
 */
function formatDetailDiffBlock(code: string, restText: string, indent: string): string[] {
  const lines: string[] = [];
  
  if (restText) {
    const formatted = formatMarkdown(restText);
    lines.push(...wrapText(formatted, `${indent}    `, terminalWidth, true));
    lines.push('');
  }

  // Diff (no wrapping)
  formatDiffBlock(code, indent).forEach(line => {
    lines.push(line);
  });
  
  return lines;
}

/**
 * Formats a code block inside a details section
 */
function formatDetailCodeBlock(language: string, code: string, restText: string, indent: string): string[] {
  const lines: string[] = [];
  
  if (restText) {
    const formatted = formatMarkdown(restText);
    lines.push(...wrapText(formatted, `${indent}    `, terminalWidth, true));
    lines.push('');
  }

  lines.push(...highlightAndWrapCode(code, language, indent));
  
  return lines;
}

/**
 * Formats a single details block
 */
function formatDetailBlock(detail: { summary: string; content: string }, indent: string): string[] {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('');

  // Summary as bold header with indent (with wrapping)
  const summaryFormatted = colors.bold(detail.summary);
  lines.push(...wrapText(summaryFormatted, `${indent}    `, terminalWidth, true));
  lines.push('');

  // Check for diff in details
  const diffMatch = detail.content.match(/```diff\n([\s\S]*)```/);
  if (diffMatch) {
    const code = diffMatch[1];
    const restText = detail.content.replace(/```diff\n[\s\S]*```/, '').trim();
    lines.push(...formatDetailDiffBlock(code, restText, indent));
    return lines;
  }

  // Check for regular code blocks with ```language
  const codeBlockMatch = detail.content.match(/```([a-z]*)\n([\s\S]*)\n```/);
  if (codeBlockMatch) {
    let language = codeBlockMatch[1] || 'text';

    // Map 'suggestion' to 'diff' for proper syntax highlighting
    if (language === 'suggestion') {
      language = 'diff';
    }

    const code = codeBlockMatch[2];
    const restText = detail.content.replace(/```[a-z]*\n[\s\S]*\n```/, '').trim();
    lines.push(...formatDetailCodeBlock(language, code, restText, indent));
    return lines;
  }

  // Plain text with wrapping
  const formatted = formatMarkdown(detail.content);
  lines.push(...wrapText(formatted, `${indent}    `, terminalWidth, true));
  
  return lines;
}

function formatCommentBody(body: string, indent: string, filePath?: string): { lines: string[]; hasSuggestion: boolean } {
  const lines: string[] = [];
  
  // Normalize line endings (GitHub can send \r\n)
  const normalizedBody = body.replace(/\r\n/g, '\n');
  
  const { text: mainText, details } = parseDetailsBlocks(normalizedBody);
  const suggestionMatch = mainText.match(/```suggestion\n([\s\S]*)```/);

  let hasSuggestion = false;
  if (suggestionMatch) {
    hasSuggestion = true;
    const code = suggestionMatch[1];
    const restText = mainText.replace(/```suggestion\n[\s\S]*```/, '').trim();
    const language = filePath ? getLanguageFromPath(filePath) : 'typescript';
    lines.push(...formatSuggestionBlock(code, restText, indent, language));
  } else {
    lines.push(...formatMainContent(mainText, indent));
  }

  // Output <details> blocks (without quote bars - will be added by formatThread)
  details.forEach(detail => {
    lines.push(...formatDetailBlock(detail, indent));
  });

  return { lines, hasSuggestion };
}

/**
 * Wraps lines in a quote block with vertical bar (colored based on author)
 */
function wrapInQuote(lines: string[], indent: string, colorFn: (s: string) => string): string[] {
  const bar = colorFn('│');
  return lines.map(line => {
    // If line is empty or just whitespace, show just the bar (no trailing spaces)
    if (!line.trim()) {
      return `${indent}  ${bar}`.trimEnd();
    }
    // Otherwise add bar with double space before content (trim trailing spaces)
    return `${indent}  ${bar}  ${line.replace(new RegExp(`^${indent}    `), '')}`.trimEnd();
  });
}

/**
 * Formats author name with @ prefix and role badges
 */
function formatAuthor(author: string, prAuthor: string): string {
  const isAuthor = author === prAuthor;
  const badges = isAuthor ? ' (author)' : '';
  return `@${author}${badges}`;
}

function formatThread(thread: ProcessedThread, indent: string, prAuthor: string, filePath: string): string {
  const lines: string[] = [];
  const useEmoji = supportsEmoji();

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
    const userColor = getUserColor(comment.author);

    // Replies get additional indent for visual nesting (4 spaces to align with main content)
    const commentIndent = i === 0 ? indent : `${indent}    `;

    // Format author with @ and badges
    const authorDisplay = formatAuthor(comment.author, prAuthor);

    if (i === 0) {
      // First comment - show author with user-specific color
      const authorLine = `${indent}${userColor(authorDisplay)}:`;
      lines.push(authorLine);
    } else {
      // Reply - show with arrow and user-specific color
      const authorLine = `${indent}  ↳ ${userColor(authorDisplay)}:`;
      lines.push(authorLine);
    }

    const { lines: bodyLines } = formatCommentBody(comment.body, commentIndent, filePath);
    
    // Add reactions if present - add to bodyLines before wrapping in quote
    if (comment.reactionGroups && comment.reactionGroups.length > 0) {
      const reactionLines = formatReactionGroups(comment.reactionGroups, useEmoji, commentIndent);
      if (reactionLines) {
        // Add empty line before reactions (don't add --- as it may duplicate)
        bodyLines.push('');
        // Split reaction lines and add each one
        reactionLines.split('\n').forEach(line => {
          bodyLines.push(line);
        });
      }
    }
    
    const quotedLines = wrapInQuote(bodyLines, commentIndent, userColor);
    lines.push(...quotedLines);

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

  const author = 'coderabbitai';
  const userColor = getUserColor(author);
  lines.push(`${indent}${userColor(`@${author}`)} ${colors.dim('[nitpick]')}:`);

  const { lines: bodyLines } = formatCommentBody(nitpick.content, indent, filePath);
  const quotedLines = wrapInQuote(bodyLines, indent, userColor);
  lines.push(...quotedLines);

  return lines.join('\n');
}

function groupByFile(
  threads: ProcessedThread[],
  nitpicks: Nitpick[],
  prMeta: PRMetadata
): FileGroup[] {
  const groups = new Map<string, FileGroup>();
  
  // Create file map for quick lookup
  const fileMap = new Map(prMeta.files.map(f => [f.path, f]));

  // Add threads (group by file only, not by line)
  threads.forEach((thread) => {
    const key = thread.path;
    if (!groups.has(key)) {
      const file = fileMap.get(key);
      groups.set(key, {
        path: thread.path,
        line: null,
        additions: file?.additions || 0,
        deletions: file?.deletions || 0,
        items: []
      });
    }
    groups.get(key)!.items.push({ type: 'thread', data: thread });
  });

  // Add nitpicks
  nitpicks.forEach((nitpick) => {
    const key = nitpick.path;
    if (!groups.has(key)) {
      const file = fileMap.get(key);
      groups.set(key, {
        path: nitpick.path,
        line: null,
        additions: file?.additions || 0,
        deletions: file?.deletions || 0,
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
  prMeta: PRMetadata;
  statePath: string;
  processedThreads: ProcessedThread[];
  botSummaries: BotSummary[];
  allThreads: Thread[];
  filter: (key: string) => boolean;
}

export function formatPlainOutput(options: FormatPlainOutputOptions): string {
  const { prMeta, processedThreads, botSummaries, allThreads, filter } = options;
  const lines: string[] = [];

  // Header
  const separator = '═'.repeat(getTerminalWidth());
  lines.push(colors.dim(separator));
  lines.push(`🔍 ${colors.bold(`PR #${prMeta.number}: ${prMeta.title}`)}`);
  
  // Stats with colored additions/deletions
  const additions = colors.greenBright(`+${prMeta.totalAdditions}`);
  const deletions = colors.yellow(`-${prMeta.totalDeletions}`);
  lines.push(`📊 Status: ${prMeta.state} | Author: ${prMeta.author} | Files: ${prMeta.files.length} | ${additions} ${deletions}`);
  
  lines.push(colors.dim(separator));
  lines.push('');

  // Extract nitpicks from bot summaries
  const allNitpicks: Nitpick[] = [];
  botSummaries.forEach((summary) => {
    if (summary.nitpicks) {
      allNitpicks.push(...summary.nitpicks);
    }
  });

  // Check if there are unprocessed threads or nitpicks to show
  if (processedThreads.length === 0 && allNitpicks.length === 0) {
    // Case 1: No threads found at all
    if (allThreads.length === 0) {
      lines.push('ℹ️  No threads found in this PR');
      lines.push('');
    } else {
      // Case 2: Threads exist but all processed
      const state = loadState(options.statePath);

      let resolvedCount = 0;
      let skippedCount = 0;
      const authorStats = new Map<string, number>();

      allThreads.forEach((thread) => {
        // Count status
        const threadState = state.threads[thread.id];
        if (threadState?.status === 'done') resolvedCount++;
        if (threadState?.status === 'skip') skippedCount++;

        // Count by author (first comment in thread)
        const author = thread.comments.nodes[0]?.author?.login || 'unknown';
        authorStats.set(author, (authorStats.get(author) || 0) + 1);
      });

      // Format output
      lines.push('✓ No unresolved threads to review');
      lines.push('');
      lines.push(`Total: ${allThreads.length} threads (${resolvedCount} resolved, ${skippedCount} skipped)`);

      // Sort authors by count (descending)
      const sortedAuthors = Array.from(authorStats.entries()).sort((a, b) => b[1] - a[1]);

      const authorLine = sortedAuthors.map(([author, count]) => `${author} (${count})`).join(', ');
      lines.push(`By author: ${authorLine}`);
      lines.push('');
    }
  } else {
    // Group by file
    const fileGroups = groupByFile(
      filter('threads') ? processedThreads : [],
      filter('nitpicks') ? allNitpicks : [],
      prMeta
    );

    // Output each file group
    fileGroups.forEach((group, idx) => {
      if (idx > 0) lines.push('');

      // Full width separator like footer
      const separator = '─'.repeat(getTerminalWidth());
      lines.push(separator);
      
      const fileStats = colors.dim(` (${colors.greenBright(`+${group.additions}`)} ${colors.yellow(`-${group.deletions}`)})`);
      lines.push(`📁 ${colors.bold(group.path)}${fileStats}`);
      
      lines.push(separator);
      lines.push('');

      group.items.forEach((item, itemIdx) => {
        if (itemIdx > 0) {
          lines.push('');
          // Item separator: indent (2) + dots, full width minus indent
          const itemSeparatorLength = Math.max(38, terminalWidth - 2);
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
  }

  // Summary
  lines.push('');
  const unresolvedCount = allThreads.filter((t) => !t.isResolved).length;
  const nitpicksCount = allNitpicks.length;
  
  // Footer with same style as header
  const footerSeparator = '═'.repeat(getTerminalWidth());
  lines.push(colors.dim(footerSeparator));
  lines.push(`📊 ${colors.bold(`Summary: ${processedThreads.length} threads, ${nitpicksCount} nitpicks, ${unresolvedCount} unresolved`)}`);
  lines.push(colors.dim(footerSeparator));

  return lines.join('\n');
}
