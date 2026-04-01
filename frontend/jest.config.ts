import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.{test,spec}.{ts,tsx}'],
  // Test report XML output
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './out',
      outputName: 'test-report.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
    }],
  ],
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/lib/mockGraphData.ts',
    '!src/components/AppHeader.tsx',
    '!src/components/GraphPreview.tsx',
    '!src/components/PredictionTable.tsx',
  ],
  coverageDirectory: './out/coverage',
  coverageReporters: ['text', 'lcov', 'cobertura', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 40,
      functions: 40,
      lines: 60,
    },
  },
};

export default createJestConfig(config);
