import { getTheme } from '../theme';

describe('getTheme', () => {
  it('returns a light theme config', () => {
    const theme = getTheme('light');
    expect(theme.token?.colorPrimary).toBe('#0891b2');
    expect(theme.token?.colorBgContainer).toBe('#ffffff');
    expect(theme.algorithm).toBeDefined();
  });

  it('returns a dark theme config', () => {
    const theme = getTheme('dark');
    expect(theme.token?.colorBgContainer).toBe('#141414');
    expect(theme.token?.colorBgElevated).toBe('#1f1f1f');
    expect(theme.algorithm).toBeDefined();
  });

  it('includes component overrides', () => {
    const theme = getTheme('light');
    expect(theme.components?.Card).toBeDefined();
    expect(theme.components?.Button).toBeDefined();
    expect(theme.components?.Steps).toBeDefined();
    expect(theme.components?.Table).toBeDefined();
  });
});
