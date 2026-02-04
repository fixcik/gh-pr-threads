import { execSync } from 'child_process';
import { getStatePath, loadState, saveState, markItem, resolveId } from '../state/manager.js';
import { runGhMutation } from '../github/client.js';
import { REPLY_MUTATION } from '../github/mutations.js';
import type { AddReplyMutationData } from '../github/apiTypes.js';

interface PRInfo {
  owner: string;
  repo: string;
  number: number;
}

function detectPR(): PRInfo {
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

export async function runReplyCommand(
  id: string,
  message: string,
  markAs?: 'done' | 'skip' | 'later'
): Promise<void> {
  const pr = detectPR();
  const statePath = getStatePath(pr.owner, pr.repo, pr.number);
  const state = loadState(statePath);

  // Resolve short ID to full ID
  const fullId = resolveId(state, id);

  if (!fullId) {
    console.error(`❌ ID '${id}' not found in state. Run gh-pr-threads first to fetch threads.`);
    process.exit(1);
  }

  // Check if it's a thread (can reply) or nitpick (cannot reply)
  if (!fullId.startsWith('PRRT_')) {
    console.error(`❌ Cannot reply to nitpick '${id}'. Only review threads support replies.`);
    process.exit(1);
  }

  try {
    // Send reply via GraphQL
    const result = runGhMutation<AddReplyMutationData>(REPLY_MUTATION, { threadId: fullId, body: message });
    const commentUrl = result.addPullRequestReviewThreadReply?.comment?.url;
    console.log(`💬 Replied to thread ${id}`);
    if (commentUrl) {
      console.log(`   ${commentUrl}`);
    }

    // Optionally mark
    if (markAs) {
      markItem(state, fullId, markAs);
      console.log(`📌 Marked as ${markAs}`);
    }

    saveState(statePath, state);
    console.log(`💾 State saved`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to reply: ${message}`);
    process.exit(1);
  }
}
