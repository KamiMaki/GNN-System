# Changelog: Jest Migration + Lint/Build Fix

**Date**: 2026-03-25
**Commit**: `b80b947`
**Type**: refactor + fix

## Changes

- Migrated test framework from **Vitest** to **Jest** (with `next/jest`, `jest-environment-jsdom`)
- Added test report output: `out/test-report.xml` (JUnit XML via `jest-junit`)
- Added coverage output: `out/coverage/` (lcov, cobertura, json-summary)
- Fixed 2 ESLint warnings: replaced `<img>` with `next/image` `<Image>` in login page and AppHeader
- Fixed build error: removed duplicate `Link` name conflict in `app/docs/page.tsx`
- Fixed TypeScript errors: widened `ForceGraph2D` callback types in `GraphPreview.tsx`
- Fixed type narrowing in `PredictionTable.tsx` for union return type
- Confirmed `.env.local` with `NEXT_PUBLIC_API_URL` works via `process.env`

## Files Changed

| File | Action |
|------|--------|
| `frontend/package.json` | Updated scripts & deps (vitest removed, jest added) |
| `frontend/jest.config.ts` | **New** - Jest config with reporters + coverage |
| `frontend/jest.setup.ts` | **Renamed** from `vitest.setup.ts`, adapted to jest |
| `frontend/vitest.config.ts` | **Deleted** |
| `frontend/vitest.setup.ts` | **Deleted** |
| `frontend/src/lib/__tests__/api.test.ts` | vitest -> jest syntax |
| `frontend/src/contexts/__tests__/ProjectContext.test.tsx` | vitest -> jest syntax |
| `frontend/src/contexts/__tests__/AuthContext.test.tsx` | vitest -> jest syntax |
| `frontend/app/login/page.tsx` | `<img>` -> `<Image>` |
| `frontend/src/components/AppHeader.tsx` | `<img>` -> `<Image>` |
| `frontend/app/docs/page.tsx` | Removed duplicate `Link` destructure |
| `frontend/src/components/GraphPreview.tsx` | Widened ForceGraph2D types |
| `frontend/src/components/PredictionTable.tsx` | Fixed union type annotation |
