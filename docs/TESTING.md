# Testing Guide

This document describes the testing approach and conventions used in the `gh-pr-threads` project.

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- src/utils/shortId.test.ts
```

## Testing Framework

The project uses **Vitest** as the testing framework, chosen for:
- Fast execution and watch mode
- Native TypeScript support
- Compatible with Jest API
- Built-in coverage with v8

## Test Organization

Tests are **co-located** with source files using the `.test.ts` suffix:

```
src/
├── utils/
│   ├── shortId.ts
│   └── shortId.test.ts    # Tests for shortId.ts
├── parsers/
│   ├── nitpicks.ts
│   └── nitpicks.test.ts   # Tests for nitpicks.ts
```

## Testing Philosophy

### What We Test

✅ **Pure Functions** (High Priority)
- `utils/shortId.ts` - Hash generation
- `parsers/nitpicks.ts` - HTML parsing logic
- `parsers/comments.ts` - Comment cleaning

✅ **Business Logic** (High Priority)
- `state/manager.ts` - State persistence and ID resolution
- `output/formatter.ts` - Output formatting

✅ **System Interactions** (Medium Priority)
- `utils/pr.ts` - GitHub CLI integration (mocked)

### What We Don't Test

❌ **CLI Entry Points** (`cli.ts`, `index.ts`)
- Integration tests would be more appropriate
- Difficult to test without E2E setup

❌ **Type Definitions** (`types.ts`)
- TypeScript compiler handles validation

❌ **GraphQL Queries** (`github/queries.ts`)
- Static strings, tested via integration

❌ **Complex UI Utilities** (`utils/images.ts`)
- Terminal rendering is environment-specific
- Would require complex mocking

## Coverage Goals

Current coverage status:

| Module | Coverage | Status |
|--------|----------|--------|
| `src/parsers` | 98.3% | ✅ Excellent |
| `src/state` | 100% | ✅ Perfect |
| `src/utils` (core) | 100% | ✅ Perfect |
| `src/output` | 100% | ✅ Perfect |

**Overall Philosophy**: Focus on **critical paths** over **coverage percentage**. A well-tested parser is more valuable than 100% coverage of trivial getters.

## Testing Patterns

### 1. Pure Function Testing

For pure functions (same input → same output), test:
- Valid inputs with expected outputs
- Edge cases (empty strings, large inputs)
- Determinism (same input always produces same output)

**Example**: `src/utils/shortId.test.ts`

```typescript
it('should be deterministic', () => {
  const result1 = shortId('test');
  const result2 = shortId('test');
  expect(result1).toBe(result2);
});
```

### 2. Mocking External Dependencies

Use Vitest's `vi.mock()` for external modules:

**Example**: `src/utils/pr.test.ts`

```typescript
import { vi } from 'vitest';
import * as childProcess from 'child_process';

vi.mock('child_process');

it('should call gh CLI', () => {
  vi.mocked(childProcess.execSync).mockReturnValue(mockData);
  detectPR();
  expect(childProcess.execSync).toHaveBeenCalledWith(...);
});
```

### 3. State Management Testing

For state management, test:
- Loading and saving
- ID resolution (short → full)
- Marking and clearing items
- Backward compatibility

**Example**: `src/state/manager.test.ts`

```typescript
it('should resolve short ID to full ID', () => {
  const state = { idMap: { 'abc123': 'full-id' } };
  expect(resolveId(state, 'abc123')).toBe('full-id');
});
```

### 4. HTML Parsing Testing

For HTML parsing, test:
- Single and multiple elements
- Nested structures
- Malformed HTML handling
- Edge cases (empty, no matches)

**Example**: `src/parsers/nitpicks.test.ts`

```typescript
it('should handle nested details blocks', () => {
  const html = '<details>Outer<details>Inner</details></details>';
  const result = findBalancedDetails(html);
  expect(result).toHaveLength(1);
});
```

## Common Patterns

### Arrange-Act-Assert

All tests follow the AAA pattern:

```typescript
it('should do something', () => {
  // Arrange: Setup test data
  const input = 'test';
  
  // Act: Execute the function
  const result = myFunction(input);
  
  // Assert: Verify the output
  expect(result).toBe('expected');
});
```

### Parameterized Tests

Use `it.each` for testing multiple scenarios:

```typescript
it.each([
  { input: 'test1', expected: 'result1' },
  { input: 'test2', expected: 'result2' },
])('should handle $input', ({ input, expected }) => {
  expect(myFunction(input)).toBe(expected);
});
```

### Mock Reset

Mocks are automatically cleared between tests:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Running Tests

### Watch Mode

Useful during development:

```bash
npm run test:watch
```

Vitest will:
- Re-run tests on file changes
- Show only changed test results
- Provide interactive filtering

### Coverage Reports

```bash
npm run test:coverage
```

Generates:
- Console summary (shown in terminal)
- HTML report (`coverage/index.html`)

View HTML report:
```bash
open coverage/index.html
```

### CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run tests
  run: npm test

- name: Check coverage
  run: npm run test:coverage
```

## Adding New Tests

When adding tests for a new module:

1. **Create test file**: `module.test.ts` next to `module.ts`
2. **Import Vitest**: `import { describe, it, expect } from 'vitest'`
3. **Group related tests**: Use `describe()` blocks
4. **Test critical paths first**: Focus on business logic
5. **Add edge cases**: Empty inputs, errors, boundary conditions

Example template:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myModule.js';

describe('myFunction', () => {
  it('should handle valid input', () => {
    const result = myFunction('valid');
    expect(result).toBe('expected');
  });

  it('should handle empty input', () => {
    const result = myFunction('');
    expect(result).toBe('');
  });

  it('should throw on invalid input', () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

## Debugging Tests

### Single Test Execution

Run only one test:

```typescript
it.only('should run only this test', () => {
  // ...
});
```

### Skip Tests

Temporarily skip a test:

```typescript
it.skip('should be skipped', () => {
  // ...
});
```

### Debug Output

Use `console.log` in tests (output shown in verbose mode):

```bash
npm test -- --reporter=verbose
```

## Best Practices

1. **Test Behavior, Not Implementation**
   - Don't test internal details
   - Test public API only

2. **Keep Tests Simple**
   - One assertion per test (when possible)
   - Clear test names
   - Minimal setup

3. **Mock External Dependencies**
   - File system (`fs`)
   - Network calls (`child_process.execSync`)
   - Environment variables

4. **Test Edge Cases**
   - Empty inputs
   - Large inputs
   - Null/undefined
   - Malformed data

5. **Maintain Test Speed**
   - No real I/O operations
   - No network calls
   - Mock heavy operations

## Tools and Libraries

- **Vitest**: Test framework and runner
- **@vitest/coverage-v8**: Code coverage with V8
- **vitest-mock-extended**: Type-safe mocking (installed but not heavily used)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Testing Best Practices](https://testingjavascript.com/)
