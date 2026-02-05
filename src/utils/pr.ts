import { execSync } from 'child_process';

export interface PRInfo {
  owner: string;
  repo: string;
  number: number;
}

/**
 * Parses PR info from URL or CLI options, with auto-detection fallback
 */
export function parsePRInfo(url?: string, options?: { owner?: string; repo?: string; number?: number }): PRInfo {
  let owner = options?.owner || '';
  let repo = options?.repo || '';
  let number = options?.number || 0;

  // Parse URL if provided
  if (url) {
    if (!url.startsWith('https://github.com/')) {
      throw new Error('Invalid PR URL. Expected a GitHub pull request URL.');
    }
    const parts = url.replace('https://github.com/', '').split('/');
    owner = parts[0];
    repo = parts[1];
    if (parts[2] !== 'pull' || !parts[3]) {
      throw new Error('Invalid PR URL. Expected a GitHub pull request URL.');
    }
    number = Number.parseInt(parts[3], 10);
    if (!owner || !repo || Number.isNaN(number)) {
      throw new Error('Invalid PR URL. Expected a GitHub pull request URL.');
    }
  }

  // Auto-detect PR from current repo if not provided
  if (!owner || !repo || !number) {
    try {
      const prInfo = JSON.parse(execSync('gh pr view --json number,url', { encoding: 'utf8' }));
      const parts = prInfo.url.replace('https://github.com/', '').split('/');
      owner = parts[0];
      repo = parts[1];
      number = prInfo.number;
    } catch {
      throw new Error('Could not detect PR. Please provide a PR URL or use --owner, --repo, --number options.');
    }
  }

  return { owner, repo, number };
}

/**
 * Detects the current PR from the git repository using gh CLI
 */
export function detectPR(): PRInfo {
  return parsePRInfo();
}
