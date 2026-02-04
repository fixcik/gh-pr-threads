# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-02-04

### Added
- Initial release
- Fetch review threads from GitHub PRs
- Parse nitpicks from CodeRabbit comments
- Filter user comments (exclude bots)
- State management for tracking processed comments
- Support for `--all`, `--include-done`, `--only` options
- Auto-detection of PR from current git repository
- GraphQL pagination support for large PRs
- Clean comment bodies (remove AI analysis chains, internal state)
- Summary statistics by author and type
- TypeScript types for all data structures
- Commander-based CLI interface
- Support for multiple filter types: threads, nitpicks, files, summaries, userComments
