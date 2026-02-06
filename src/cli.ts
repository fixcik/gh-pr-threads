import { Command } from 'commander';
import type { Args } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import { getStatePath } from './state/manager.js';
import { runMarkCommand, MarkStatus } from './commands/mark.js';
import { runReplyCommand } from './commands/reply.js';
import { runResolveCommand } from './commands/resolve.js';
import { parsePRInfo } from './utils/pr.js';

const MARK_STATUSES = ['done', 'skip', 'later'] as const;
type MarkStatusType = typeof MARK_STATUSES[number];

const SUBCOMMANDS = ['mark', 'reply', 'resolve', 'react', 'clear'] as const;

function parsePRNumber(value: string): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) {
    console.error(`Error: Invalid PR number '${value}'. Must be a positive integer.`);
    process.exit(1);
  }
  return n;
}

function addPROptions(cmd: Command): Command {
  return cmd
    .option('--pr <url>', 'PR URL (auto-detects from current repo if omitted)')
    .option('--owner <owner>', 'Repository owner')
    .option('--repo <repo>', 'Repository name')
    .option('--number <number>', 'PR number', parsePRNumber);
}

function validateMarkStatus(status: string | undefined): asserts status is MarkStatusType | undefined {
  if (status !== undefined && !MARK_STATUSES.includes(status as MarkStatusType)) {
    console.error(`Error: Invalid mark status '${status}'. Must be one of: ${MARK_STATUSES.join(', ')}`);
    process.exit(1);
  }
}

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
    .option('--only <types>', 'Comma-separated list: threads,nitpicks,files,summaries')
    .option('--with-resolved', 'Include resolved threads/comments (default: only unresolved)', false)
    .option('--ignore-bots', 'Exclude all bot comments and summaries', false)
    .option('--json', 'Output in JSON format (default: plain text)', false)
    .option('--thread <id>', 'Show specific thread by short ID (bypasses all filters)')
    .option('--no-cache', 'Force full refetch, ignore cached cursors', false)
    .option('--cache-ttl <minutes>', 'Cache TTL in minutes (default: 60)', '60')
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
      try {
        const { owner, repo, number } = parsePRInfo(url, options);
        const statePath = getStatePath(owner, repo, number);
        const stateDir = path.dirname(statePath);
        const imagesDir = path.join(stateDir, 'images');

        let cleared = false;

        if (fs.existsSync(statePath)) {
          fs.unlinkSync(statePath);
          console.log(`State cleared for PR ${owner}/${repo}#${number}`);
          console.log(`Removed: ${statePath}`);
          cleared = true;
        }

        if (fs.existsSync(imagesDir)) {
          fs.rmSync(imagesDir, { recursive: true });
          console.log(`Removed images: ${imagesDir}`);
          cleared = true;
        }

        if (!cleared) {
          console.log(`No state file found for PR ${owner}/${repo}#${number}`);
        }

        process.exit(0);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // Mark command
  const markCmd = program
    .command('mark')
    .description('Mark thread/nitpick(s) as done, skip, later, or clear the mark')
    .argument('<status>', 'Status: done, skip, later, or clear')
    .argument('<ids...>', 'Thread or nitpick short ID(s) (6 characters each)')
    .option('--note <text>', 'Optional note');

  addPROptions(markCmd)
    .action(async (status, ids, options) => {
      const validStatuses = ['done', 'skip', 'later', 'clear'];
      if (!validStatuses.includes(status)) {
        console.error(`Error: Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`);
        process.exit(1);
      }
      const prOptions = { pr: options.pr, owner: options.owner, repo: options.repo, number: options.number };
      runMarkCommand(ids, status as MarkStatus, options.note, prOptions);
      process.exit(0);
    });

  // Reply command
  const replyCmd = program
    .command('reply')
    .description('Reply to review thread(s)')
    .argument('<message>', 'Reply message')
    .argument('<ids...>', 'Thread short ID(s) (6 characters each)')
    .option('--mark <status>', 'Also mark as done/skip/later after replying');

  addPROptions(replyCmd)
    .action((message, ids, options) => {
      try {
        validateMarkStatus(options.mark);
        const prOptions = { pr: options.pr, owner: options.owner, repo: options.repo, number: options.number };
        runReplyCommand(ids, message, options.mark, prOptions);
        process.exit(0);
      } catch (error: unknown) {
        console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // Resolve command
  const resolveCmd = program
    .command('resolve')
    .description('Resolve review thread(s) on GitHub')
    .argument('<ids...>', 'Thread short ID(s) (6 characters each)')
    .option('--reply <message>', 'Add reply before resolving')
    .option('--mark <status>', 'Also mark as done/skip/later after resolving');

  addPROptions(resolveCmd)
    .action((ids, options) => {
      try {
        validateMarkStatus(options.mark);
        const prOptions = { pr: options.pr, owner: options.owner, repo: options.repo, number: options.number };
        runResolveCommand(ids, options.reply, options.mark, prOptions);
        process.exit(0);
      } catch (error: unknown) {
        console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // React command
  const reactCmd = program
    .command('react')
    .description('Add reaction to comment(s)')
    .argument('<reaction>', 'Reaction type (THUMBS_UP, ❤️, etc.)')
    .argument('<ids...>', 'Comment short ID(s) (6 characters each)');

  addPROptions(reactCmd)
    .action(async (reaction: string, ids: string[], options: Record<string, unknown>) => {
      try {
        const { runReactCommand } = await import('./commands/react.js');
        const prOptions = { pr: options.pr as string, owner: options.owner as string, repo: options.repo as string, number: options.number as number };
        runReactCommand(ids, reaction, prOptions);
        process.exit(0);
      } catch (error: unknown) {
        console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  program.parse();

  // If a subcommand was executed (mark, reply, resolve, clear), it will call process.exit()
  // and this code won't run. Only run default command parsing if no subcommand was matched.
  const isSubcommand = process.argv[2] && SUBCOMMANDS.includes(process.argv[2] as typeof SUBCOMMANDS[number]);

  if (isSubcommand) {
    // Subcommand will handle its own exit, this is unreachable
    // but TypeScript needs a return
    return {} as Args;
  }

  const options = program.opts();
  const url = program.args[0];

  try {
    const { owner, repo, number } = parsePRInfo(url, options);
    const only = options.only ? options.only.split(',').map((s: string) => s.trim()) : [];

    return {
      owner,
      repo,
      number,
      showAll: options.all,
      only,
      includeDone: options.includeDone,
      withResolved: options.withResolved,
      format: options.json ? 'json' : 'plain',
      ignoreBots: options.ignoreBots || false,
      threadId: options.thread,
      noCache: options.cache === false,  // --no-cache sets cache to false
      cacheTtl: parseInt(options.cacheTtl || '60', 10)
    };
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Usage: gh-pr-threads <PR_URL> [--all] [--include-done] [--only=threads,nitpicks,files,summaries] [--ignore-bots]');
    process.exit(1);
  }
}
