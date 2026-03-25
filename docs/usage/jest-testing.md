# Testing Guide (Jest)

## Quick Start

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage
```

## Test Reports

After running tests, reports are generated in `frontend/out/`:

| Report | Path | Format |
|--------|------|--------|
| Test results | `out/test-report.xml` | JUnit XML |
| Coverage summary | `out/coverage/coverage-summary.json` | JSON |
| Coverage detail | `out/coverage/lcov.info` | LCOV |
| Coverage HTML | `out/coverage/lcov-report/index.html` | HTML |
| Coverage XML | `out/coverage/cobertura-coverage.xml` | Cobertura XML |

## Environment Variables

API base URL is configured via `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- Uses Next.js built-in `.env.local` loading
- Accessed via `process.env.NEXT_PUBLIC_API_URL`
- Fallback default: `http://localhost:8000`

## Writing Tests

Tests use Jest globals (`describe`, `it`, `expect`, `jest.fn()`, `jest.mock()`):

```typescript
import { render, screen } from '@testing-library/react';

jest.mock('@/lib/api', () => ({
  listProjects: jest.fn(),
}));

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Test File Location

Tests live next to their source in `__tests__/` directories:

```
src/
  lib/
    __tests__/
      api.test.ts
  contexts/
    __tests__/
      AuthContext.test.tsx
      ProjectContext.test.tsx
```
