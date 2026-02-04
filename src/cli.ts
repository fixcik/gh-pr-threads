import { Command } from 'commander';
import { execSync } from 'child_process';
import type { Args } from './types.js';
import * as fs from 'fs';
import { getStatePath } from './state/manager.js';

export function parseCliArgs(): Args {
  const program = new Command();

  program
    .name('gh-pr-threads')
    .description('Fetch and filter GitHub PR review threads, comments, and nitpicks')
    .version('0.2.0');

  // Default command - fetch PR data
  program
    .argument('[url]', 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)')
    .option('--owner <owner>', 'Repository owner')
    .option('--repo <repo>', 'Repository name')
    .option('--number <number>', 'PR number', parseInt)
    .option('--all', 'Show all threads including resolved ones', false)
    .option('--include-done', 'Include threads/nitpicks marked as done or skip', false)
    .option('--only <types>', 'Comma-separated list: threads,nitpicks,files,summaries,userComments')
    .option('--with-resolved', 'Include resolved threads/comments (default: only unresolved)', false)
    .option('--json', 'Output in JSON format (default: plain text)', false)
    .action(() => {});

  // Clear command
  program
    .command('clear')
    .description('Clear all done/skip marks for the current or specified PR')
    .argument('[url]', 'GitHub PR URL (optional, auto-detects from current repo)')
    .option('--owner <owner>', 'Repository owner')
    .option('--repo <repo>', 'Repository name')
    .option('--number <number>', 'PR number', parseInt)
    .action((url, options) => {
      let owner = options.owner || '';
      let repo = options.repo || '';
      let number = options.number || 0;

      // Parse URL if provided
      if (url && url.startsWith('https://github.com/')) {
        const parts = url.replace('https://github.com/', '').split('/');
        owner = parts[0];
        repo = parts[1];
        if (parts[2] === 'pull') {
          number = parseInt(parts[3], 10);
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
        } catch (e) {
          console.error('Error: Could not detect PR. Please provide a PR URL or use --owner, --repo, --number options.');
          process.exit(1);
        }
      }

      const statePath = getStatePath(owner, repo, number);

      if (fs.existsSync(statePath)) {
        fs.unlinkSync(statePath);
        console.log(`State cleared for PR ${owner}/${repo}#${number}`);
        console.log(`Removed: ${statePath}`);
      } else {
        console.log(`No state file found for PR ${owner}/${repo}#${number}`);
      }

      process.exit(0);
    });

  program.parse();

  const options = program.opts();
  const url = program.args[0];

  let owner = options.owner || '';
  let repo = options.repo || '';
  let number = options.number || 0;

  // Parse URL if provided
  if (url && url.startsWith('https://github.com/')) {
    const parts = url.replace('https://github.com/', '').split('/');
    owner = parts[0];
    repo = parts[1];
    if (parts[2] === 'pull') {
      number = parseInt(parts[3], 10);
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
    } catch (e) {
      console.error('Error: Could not detect PR. Please provide a PR URL or use --owner, --repo, --number options.');
      console.error('Usage: gh-pr-threads <PR_URL> [--all] [--include-done] [--only=threads,nitpicks,files,summaries,userComments]');
      process.exit(1);
    }
  }

  const only = options.only ? options.only.split(',').map((s: string) => s.trim()) : [];

  return {
    owner,
    repo,
    number,
    showAll: options.all,
    only,
    includeDone: options.includeDone,
    withResolved: options.withResolved,
    format: options.json ? 'json' : 'plain'
  };
}
