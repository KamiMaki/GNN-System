'use client';
import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

export const getTheme = (mode: 'light' | 'dark'): ThemeConfig => ({
  algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    fontFamily: 'var(--font-noto-sans-tc), "Noto Sans TC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    borderRadius: 10,
    colorPrimary: '#0891b2',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#06b6d4',
    wireframe: false,
    fontSize: 14,
    colorBgContainer: mode === 'dark' ? '#141414' : '#ffffff',
    colorBgElevated: mode === 'dark' ? '#1f1f1f' : '#ffffff',
    boxShadow: mode === 'light'
      ? '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)'
      : '0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
    boxShadowSecondary: mode === 'light'
      ? '0 6px 16px rgba(0, 0, 0, 0.08), 0 3px 6px rgba(0, 0, 0, 0.04)'
      : '0 6px 16px rgba(0, 0, 0, 0.4), 0 3px 6px rgba(0, 0, 0, 0.3)',
  },
  components: {
    Card: {
      borderRadiusLG: 14,
      boxShadowTertiary:
        mode === 'light'
          ? '0 1px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)'
          : '0 1px 4px rgba(0, 0, 0, 0.3)',
      paddingLG: 24,
    },
    Button: {
      borderRadius: 10,
      controlHeight: 38,
      primaryShadow: '0 2px 8px -2px rgba(8, 145, 178, 0.4)',
      fontWeight: 500,
    },
    Steps: {
      dotCurrentSize: 10,
    },
    Table: {
      borderRadiusLG: 12,
      headerBg: mode === 'light' ? 'rgba(8, 145, 178, 0.03)' : 'rgba(8, 145, 178, 0.06)',
    },
    Input: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Select: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Modal: {
      borderRadiusLG: 16,
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Statistic: {
      contentFontSize: 28,
    },
    Progress: {
      defaultColor: '#0891b2',
    },
    Divider: {
      colorSplit: mode === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.06)',
    },
  },
});
