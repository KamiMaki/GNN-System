# Testing Guide

## Unit Tests
This project uses **Jest** and **React Testing Library** for unit testing.

### Running Tests
- Run all tests: `npm test`
- Run in watch mode: `npm run test:watch`

### Test Structure
- Tests are located in the `__tests__` directory.
- `Sidebar.test.tsx`: Verifies navigation links, user profile rendering, and basic rendering of the sidebar.

## Integration Tests
Integration testing is performed by ensuring the application builds and pages load correctly.
- Manual Smoke Test: Navigate to `/dashboard`, `/explore`, `/train` to ensure no crashes.
