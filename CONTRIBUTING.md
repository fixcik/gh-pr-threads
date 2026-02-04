# Contributing to gh-pr-threads

Thank you for your interest in improving gh-pr-threads!

## Development

### Requirements
- Node.js >= 18
- npm >= 9
- GitHub CLI (gh) installed and authenticated

### Development Setup

```bash
git clone <your-fork>
cd gh-pr-threads
npm install
```

### Development

```bash
# Run in dev mode
npm run dev -- <PR_URL> [options]

# Build
npm run build

# Type checking
npx tsc --noEmit
```

### Project Structure

```
src/
├── index.ts              # CLI entry point
├── cli.ts                # Argument parsing (commander)
├── types.ts              # Type definitions
├── github/
│   ├── client.ts         # gh CLI wrapper
│   ├── queries.ts        # GraphQL queries
│   └── fetcher.ts        # Data fetching with pagination
├── parsers/
│   ├── nitpicks.ts       # Nitpick parsing from comments
│   └── comments.ts       # Comment cleaning
├── state/
│   └── manager.ts        # State management (pr-state.json)
└── output/
    └── formatter.ts      # Output formatting
```

## New Features

If you want to add a new feature:

1. Create an issue with a description
2. Wait for discussion
3. Fork the repository
4. Create a feature branch
5. Implement the feature with tests
6. Create a Pull Request

## Bugs

For bugs:

1. Check that the bug hasn't been reported yet
2. Create an issue with:
   - Bug description
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Node.js and gh CLI versions

## Pull Requests

- Describe changes in the PR description
- Update CHANGELOG.md
- Ensure the project builds without errors
- Verify that existing functionality isn't broken

## Code Style

- TypeScript strict mode
- ESM modules (import/export)
- Prefer explicit types over `any`
- Use meaningful variable names
- Add JSDoc comments for public functions
