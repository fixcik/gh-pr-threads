import * as crypto from 'crypto';
import type { Nitpick } from '../types.js';

export function getNitpickId(filePath: string, line: string, content: string): string {
  if (filePath && line && filePath !== 'unknown' && !filePath.toLowerCase().includes('comments')) {
    return `${filePath}:${line}`;
  }
  return crypto.createHash('sha1').update(content).digest('hex').substring(0, 8);
}

export function findBalancedDetails(
  body: string,
  summaryFilter?: RegExp
): { full: string; content: string; summary: string }[] {
  const results: { full: string; content: string; summary: string }[] = [];
  const detailsStartRegex = /<details[\s>]/g;
  let match;

  while ((match = detailsStartRegex.exec(body)) !== null) {
    const startPos = match.index;
    let depth = 1;
    let currentPos = match.index + match[0].length;

    while (depth > 0 && currentPos < body.length) {
      const nextOpen = body.indexOf('<details', currentPos);
      const nextClose = body.indexOf('</details>', currentPos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        currentPos = nextOpen + 8;
      } else {
        depth--;
        currentPos = nextClose + 10;
      }
    }

    if (depth === 0) {
      const fullBlock = body.substring(startPos, currentPos);
      const summaryMatch = fullBlock.match(/<summary>([\s\S]*?)<\/summary>/);
      const summary = summaryMatch ? summaryMatch[1] : '';

      if (!summaryFilter || summaryFilter.test(summary)) {
        const summaryEndTag = '</summary>';
        const summaryEndIndex = fullBlock.indexOf(summaryEndTag);
        const content =
          summaryEndIndex !== -1
            ? fullBlock.substring(summaryEndIndex + summaryEndTag.length, fullBlock.length - 10).trim()
            : '';

        results.push({ full: fullBlock, content, summary });
      }

      detailsStartRegex.lastIndex = currentPos;
    }
  }
  return results;
}

export function parseNitpicks(body: string): Nitpick[] {
  const nitpicks: Nitpick[] = [];
  const sections = findBalancedDetails(body, /(Nitpick|Additional) comments/);

  for (const section of sections) {
    const fileBlocks = findBalancedDetails(section.content);
    for (const fileBlock of fileBlocks) {
      const summaryMatch = fileBlock.summary.match(/(.*?) \((\d+)\)/);
      if (!summaryMatch) continue;

      const filePath = summaryMatch[1].trim();
      const fileContent = fileBlock.content.replace(/^<blockquote>\s*/, '').replace(/\s*<\/blockquote>$/, '');
      const commentRegex = /`(\d+(?:-\d+)?)`:\s*([\s\S]*?)(?=`\d+|$)/g;
      let commentMatch;

      while ((commentMatch = commentRegex.exec(fileContent)) !== null) {
        const line = commentMatch[1];
        const content = commentMatch[2].trim();
        nitpicks.push({
          id: getNitpickId(filePath, line, content),
          path: filePath,
          line: line,
          content: content
        });
      }
    }
  }
  return nitpicks;
}
