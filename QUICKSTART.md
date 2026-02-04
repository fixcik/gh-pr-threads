# Quick Start

## Usage (after publishing)

```bash
npx gh-pr-threads https://github.com/owner/repo/pull/123
```

## Local Testing (right now)

```bash
# From any directory with a git repository and open PR
~/projects/ai/gh-pr-threads/dist/index.js --only=userComments

# Or with URL
~/projects/ai/gh-pr-threads/dist/index.js https://github.com/owner/repo/pull/123
```

## Development Setup

```bash
cd ~/projects/ai/gh-pr-threads
npm install
npm run build
```

## Quick Test

```bash
# Run verification
./verify.sh

# Show help
node dist/index.js --help

# Get version
node dist/index.js --version
```

## Publishing to NPM

```bash
# 1. Make sure everything works
./verify.sh

# 2. Update package.json (repository URLs)

# 3. Create git repository
git init
git add .
git commit -m "Initial release v1.0.0"

# 4. Publish
npm login
npm publish

# 5. Use it
npx gh-pr-threads --help
```

## Usage Examples

```bash
# Only user comments
gh-pr-threads <PR_URL> --only=userComments

# Only CodeRabbit nitpicks
gh-pr-threads <PR_URL> --only=nitpicks

# All threads including resolved
gh-pr-threads <PR_URL> --only=threads --all

# Show statistics
gh-pr-threads <PR_URL> | jq '.summary'

# Clear state and start fresh
gh-pr-threads clear <PR_URL>
```

For more details, see:
- **README.md** - full documentation
- **EXAMPLES.md** - more examples with jq
- **PROJECT_SUMMARY.md** - implementation details
