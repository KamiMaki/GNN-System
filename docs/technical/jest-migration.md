# Technical: Jest Migration from Vitest

## What Changed

### New Files
- `frontend/jest.config.ts` - Jest configuration using `next/jest`
- `frontend/jest.setup.ts` - Test setup (jest-dom matchers, matchMedia mock, Ant Design compat)

### Deleted Files
- `frontend/vitest.config.ts`
- `frontend/vitest.setup.ts`

### Modified Files
- `frontend/package.json` - Scripts & dependencies updated
- 3 test files - `vi` replaced with `jest` globals
- 4 source files - ESLint/TypeScript fixes

## Why

1. **Jest is the standard for Next.js** - `next/jest` provides first-class integration (SWC transforms, module resolution, CSS mocking)
2. **CI/CD integration** - `jest-junit` produces standard JUnit XML that CI systems (Jenkins, GitLab, Azure DevOps) natively consume
3. **Coverage reporting** - Cobertura XML + LCOV for integration with SonarQube, Codecov, etc.

## How It Works

### Configuration Chain

```
jest.config.ts
  -> next/jest.js (createJestConfig)
     -> Adds SWC transform for TS/TSX
     -> Resolves @/ path alias
     -> Mocks CSS/image imports
  -> jest-junit reporter
     -> Writes out/test-report.xml
  -> Coverage collectors
     -> Writes out/coverage/
```

### Key Config (`jest.config.ts`)

- `testEnvironment: 'jest-environment-jsdom'` - Browser-like DOM for React testing
- `setupFilesAfterEnv: ['./jest.setup.ts']` - Loads jest-dom matchers + Ant Design mocks
- `moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }` - Path alias resolution
- `reporters: ['default', ['jest-junit', ...]]` - Console + XML output
- `coverageReporters: ['text', 'lcov', 'cobertura', 'json-summary']` - Multiple formats

### Setup File (`jest.setup.ts`)

1. Imports `@testing-library/jest-dom` - Adds `.toBeInTheDocument()`, `.toHaveTextContent()`, etc.
2. Mocks `window.getComputedStyle` - Ant Design uses pseudo-elements unsupported by jsdom
3. Mocks `window.matchMedia` - Required for Ant Design responsive components
4. Calls `cleanup()` after each test - Prevents DOM leaks

### Syntax Migration (vitest -> jest)

| Vitest | Jest |
|--------|------|
| `import { vi } from 'vitest'` | Global `jest` object |
| `vi.fn()` | `jest.fn()` |
| `vi.mock()` | `jest.mock()` |
| `vi.mocked()` | `jest.mocked()` |
| `vi.clearAllMocks()` | `jest.clearAllMocks()` |
| `import { describe, it, expect } from 'vitest'` | Globals (no import needed) |

### .env Configuration

- `.env.local` is loaded automatically by Next.js at build/dev time
- `NEXT_PUBLIC_*` prefix makes vars available in browser bundle
- `process.env.NEXT_PUBLIC_API_URL` is replaced at build time by Next.js
- Fallback: `const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'`

## Usage

```bash
npm test              # Run all tests + generate XML report
npm run test:coverage # Run with coverage in out/coverage/
```

## Caveats

- Jest 30 requires `next/jest.js` (explicit `.js` extension) due to ESM resolution
- `setupFilesAfterEnv` (not `setupFiles`) is needed for jest-dom matchers to work
- `next/jest` automatically handles CSS module mocking - no need for `identity-obj-proxy` in most cases
- Coverage thresholds are not enforced yet; can be added via `coverageThreshold` in config
