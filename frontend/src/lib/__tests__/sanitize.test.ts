import { sanitizeParam } from '../sanitize';

describe('sanitizeParam', () => {
  it('returns valid alphanumeric string as-is', () => {
    expect(sanitizeParam('abc123')).toBe('abc123');
  });

  it('allows hyphens and underscores', () => {
    expect(sanitizeParam('my-project_1')).toBe('my-project_1');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeParam(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(sanitizeParam('')).toBe('');
  });

  it('returns empty string for invalid characters', () => {
    expect(sanitizeParam('abc<script>')).toBe('');
    expect(sanitizeParam('path/traversal')).toBe('');
    expect(sanitizeParam('spaces not allowed')).toBe('');
  });

  it('handles string array by taking first element', () => {
    expect(sanitizeParam(['first', 'second'])).toBe('first');
  });

  it('returns empty string for array with invalid first element', () => {
    expect(sanitizeParam(['bad chars!'])).toBe('');
  });
});
