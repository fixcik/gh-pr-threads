import { execSync } from 'child_process';

export interface PRInfo {
  owner: string;
  repo: string;
  number: number;
}

/**
 * Detects the current PR from the git repository using gh CLI
 */
export function detectPR(): PRInfo {
  try {
    const prInfo = JSON.parse(execSync('gh pr view --json number,url', { encoding: 'utf8' }));
    const parts = prInfo.url.replace('https://github.com/', '').split('/');
    return {
      owner: parts[0],
      repo: parts[1],
      number: prInfo.number
    };
  } catch {
    throw new Error('Could not detect PR. Make sure you are in a git repository with an open PR.');
  }
}
