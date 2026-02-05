import { execSync } from 'child_process';

export interface PRInfo {
  owner: string;
  repo: string;
  number: number;
}

/**
 * Parses PR info from URL or CLI options, with auto-detection fallback
 */
/**
 * Parses PR info from GitHub URL
 */
function parsePRFromURL(url: string): PRInfo {
  if (!url.startsWith('https://github.com/')) {
    throw new Error('Invalid PR URL. Expected a GitHub pull request URL.');
  }
  
  const parts = url.replace('https://github.com/', '').split('/');
  const owner = parts[0];
  const repo = parts[1];
  
  if (parts[2] !== 'pull' || !parts[3]) {
    throw new Error('Invalid PR URL. Expected a GitHub pull request URL.');
  }
  
  const number = Number.parseInt(parts[3], 10);
  
  if (!owner || !repo || Number.isNaN(number)) {
    throw new Error('Invalid PR URL. Expected a GitHub pull request URL.');
  }
  
  return { owner, repo, number };
}

/**
 * Auto-detects current PR using gh CLI
 */
function detectCurrentPR(): PRInfo {
  try {
    const prInfo = JSON.parse(execSync('gh pr view --json number,url', { encoding: 'utf8' }));
    const parts = prInfo.url.replace('https://github.com/', '').split('/');
    return {
      owner: parts[0],
      repo: parts[1],
      number: prInfo.number
    };
  } catch {
    throw new Error('Could not detect PR. Please provide a PR URL or use --owner, --repo, --number options.');
  }
}

export function parsePRInfo(url?: string, options?: { owner?: string; repo?: string; number?: number }): PRInfo {
  // Use provided URL
  if (url) {
    return parsePRFromURL(url);
  }
  
  // Use explicitly provided options
  const owner = options?.owner || '';
  const repo = options?.repo || '';
  const number = options?.number || 0;
  
  if (owner && repo && number) {
    return { owner, repo, number };
  }
  
  // Auto-detect from current repo
  return detectCurrentPR();
}

/**
 * Detects the current PR from the git repository using gh CLI
 */
export function detectPR(): PRInfo {
  return parsePRInfo();
}
