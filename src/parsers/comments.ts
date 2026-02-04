import { findBalancedDetails } from './nitpicks.js';

export function cleanCommentBody(body: string): string {
  const preservedSections = findBalancedDetails(body, /(Nitpick|Additional) comments/);
  const preserved = preservedSections.map(s => s.full);

  let cleaned = body
    .replace(/<details>\s*<summary>🧩 Analysis chain<\/summary>[\s\S]*?<\/details>/g, '')
    .replace(/<details>\s*<summary>🤖 Prompt for AI Agents<\/summary>[\s\S]*?<\/details>/g, '')
    .replace(/<!-- internal state start -->[\s\S]*?<!-- internal state end -->/g, '')
    .replace(/<details>\s*<summary>❤️ Share<\/summary>[\s\S]*?<\/details>/g, '')
    .replace(/## Sequence Diagram\(s\)[\s\S]*?(?=##|$)/g, '')
    .replace(/## Changes[\s\S]*?(?=##|$)/g, '')
    .replace(/## Poem[\s\S]*?(?=##|$)/g, '')
    .replace(/## Estimated code review effort[\s\S]*?(?=##|$)/g, '')
    .replace(/<details>\s*<summary>📜 Recent review details<\/summary>[\s\S]*?(?=<details>\s*<summary>.*?Additional comments|<details>\s*<summary>.*?Nitpick comments|<!--|$)/g, '')
    .replace(/<sub>✏️ Tip:[\s\S]*?<\/sub>/g, '')
    .replace(/Thanks for using \[CodeRabbit\][\s\S]*/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  for (const p of preserved) {
    const summaryMatch = p.match(/<summary>([\s\S]*?)<\/summary>/);
    if (summaryMatch && !cleaned.includes(summaryMatch[0])) {
      cleaned += '\n\n### Preserved Comments\n' + p;
    }
  }

  const MAX_LENGTH = 15000;
  if (cleaned.length > MAX_LENGTH) {
    return cleaned.substring(0, MAX_LENGTH) + '\n\n... [TRUNCATED] ...';
  }
  return cleaned;
}
