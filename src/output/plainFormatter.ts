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

  // Разбиваем на параграфы (пустая строка = новый параграф)
  const paragraphs = text.split(/\n\n+/);

  paragraphs.forEach((para, paraIdx) => {
    if (paraIdx > 0) lines.push(''); // Пустая строка между параграфами

    const paraLines = para.split('\n');

    paraLines.forEach(line => {
      if (stripAnsi(line).length <= availableWidth) {
        lines.push(indent + line);
        return;
      }

      // Нужен перенос
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
 * Форматирует markdown текст (жирный, италик, inline code)
 */
function formatMarkdown(text: string): string {
  // Inline code: `code`
  text = text.replace(/`([^`]+)`/g, (_, code) => colors.yellow(code));

  // Жирный: **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, (_, content) => colors.bold(content));

  // Италик: *text* или _text_ (но не внутри слов)
  text = text.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, (_, content) => colors.italic(content));
  text = text.replace(/(?<!\w)_([^_]+)_(?!\w)/g, (_, content) => colors.italic(content));

  return text;
}

/**
 * Форматирует diff блок с подсветкой
 */
function formatDiffBlock(code: string, indent: string): string[] {
  const lines: string[] = [];

  code.split('\n').forEach(line => {
    if (line.startsWith('+')) {
      // Добавленная строка - зеленая
      lines.push(`${indent}      ${colors.green(line)}`);
    } else if (line.startsWith('-')) {
      // Удаленная строка - красная
      lines.push(`${indent}      ${colors.red(line)}`);
    } else if (line.startsWith('@@')) {
      // Hunk header - голубой
      lines.push(`${indent}      ${colors.cyan(line)}`);
    } else {
      // Контекст - обычный
      lines.push(`${indent}      ${colors.dim(line)}`);
    }
  });

  return lines;
}

/**
 * Парсит и форматирует HTML <details> блоки
 */
function parseDetailsBlocks(text: string): { text: string; details: Array<{ summary: string; content: string }> } {
  const details: Array<{ summary: string; content: string }> = [];

  // Находим все <details> блоки
  const detailsRegex = /<details>\s*<summary>(.*?)<\/summary>\s*([\s\S]*?)<\/details>/gi;

  let match;
  while ((match = detailsRegex.exec(text)) !== null) {
    const summary = match[1].trim();
    const content = match[2].trim();
    details.push({ summary, content });
  }

  // Удаляем <details> блоки из текста
  const cleanText = text.replace(detailsRegex, '').trim();

  return { text: cleanText, details };
}

/**
 * Форматирует body комментария:
 * - Показывает suggestion код с подсветкой синтаксиса
 * - Выделяет markdown (жирный, италик, inline code)
 * - Форматирует diff блоки с цветной подсветкой
 * - Выводит <details> блоки как quote с жирным заголовком
 * - Переносит длинные строки с учетом ширины терминала
 */
function formatCommentBody(body: string, indent: string): { lines: string[]; hasSuggestion: boolean } {
  const lines: string[] = [];
  let hasSuggestion = false;

  // 1. Парсим HTML <details> блоки
  const { text: mainText, details } = parseDetailsBlocks(body);

  // 2. Проверяем есть ли suggestion блок
  const suggestionMatch = mainText.match(/```suggestion\n([\s\S]*?)```/);

  if (suggestionMatch) {
    hasSuggestion = true;
    const code = suggestionMatch[1];
    const restText = mainText.replace(/```suggestion\n[\s\S]*?```/, '').trim();

    // Показываем suggestion с подсветкой
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
  } else {
    // 3. Проверяем на diff блок
    const diffMatch = mainText.match(/```diff\n([\s\S]*?)```/);

    if (diffMatch) {
      const code = diffMatch[1];
      const restText = mainText.replace(/```diff\n[\s\S]*?```/, '').trim();

      // Показываем текст перед diff с переносом
      if (restText) {
        const formatted = formatMarkdown(restText);
        lines.push(...wrapText(formatted, `${indent}    `));
      }

      // Показываем diff с подсветкой (без переноса - код не переносим)
      if (restText) lines.push(''); // Пустая строка только если был текст перед diff
      lines.push(...formatDiffBlock(code, indent));
    } else {
      // 4. Просто форматируем markdown с переносом
      const formatted = formatMarkdown(mainText);
      lines.push(...wrapText(formatted, `${indent}    `));
    }
  }

  // 5. Выводим <details> блоки как quote (с отступом)
  details.forEach(detail => {
    lines.push('');

    // Summary как жирный заголовок с отступом (с переносом)
    const summaryFormatted = colors.bold('> ' + detail.summary);
    lines.push(...wrapText(summaryFormatted, `${indent}    `));
    lines.push(`${indent}    >`);

    // Проверяем на diff в details
    const diffMatch = detail.content.match(/```diff\n([\s\S]*?)```/);

    if (diffMatch) {
      const code = diffMatch[1];
      const restText = detail.content.replace(/```diff\n[\s\S]*?```/, '').trim();

      if (restText) {
        const formatted = formatMarkdown(restText);
        lines.push(...wrapText(formatted, `${indent}    > `));
        lines.push(`${indent}    >`);
      }

      // Diff в quote (без переноса)
      formatDiffBlock(code, indent).forEach(line => {
        lines.push(`${indent}    >` + line.slice(indent.length + 4));
      });
    } else {
      // Обычный текст в quote с переносом
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

export function formatPlainOutput(
  prMeta: { number: number; title: string; state: string; author: string; files: unknown[] },
  statePath: string,
  processedThreads: ProcessedThread[],
  botSummaries: BotSummary[],
  allThreads: Array<{ isResolved: boolean }>,
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
    filter('nitpicks') ? allNitpicks : []
  );

  // Output each file group
  fileGroups.forEach((group, idx) => {
    if (idx > 0) lines.push('');

    // Вычисляем длину: эмодзи (2) + пробел (1) + длина пути, минимум 40
    const fileNameLength = Math.max(40, 3 + group.path.length);
    const separator = '─'.repeat(Math.min(fileNameLength, terminalWidth));
    lines.push(separator);
    lines.push(`📁 ${colors.bold(group.path)}`);
    lines.push(separator);
    lines.push('');

    group.items.forEach((item, itemIdx) => {
      if (itemIdx > 0) {
        lines.push('');
        // Разделитель между элементами: отступ (2) + точки, минимум 38
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
