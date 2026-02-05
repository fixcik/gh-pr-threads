import { describe, it, expect } from 'vitest';
import { ADD_REACTION_MUTATION } from './mutations.js';

describe('GitHub mutations', () => {
  it('ADD_REACTION_MUTATION should have correct structure', () => {
    expect(ADD_REACTION_MUTATION).toContain('mutation');
    expect(ADD_REACTION_MUTATION).toContain('addReaction');
    expect(ADD_REACTION_MUTATION).toContain('subjectId');
    expect(ADD_REACTION_MUTATION).toContain('content');
    expect(ADD_REACTION_MUTATION).toContain('reaction');
  });
});
