'use client';
import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

export const getTheme = (mode: 'light' | 'dark'): ThemeConfig => ({
  algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    borderRadius: 8,
    colorPrimary: '#4f46e5',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
    wireframe: false,
  },
  components: {
    Card: {
      borderRadiusLG: 12,
      boxShadowTertiary:
        mode === 'light'
          ? '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.3)',
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
      primaryShadow: '0 2px 4px -1px rgba(79, 70, 229, 0.3)',
    },
    Steps: {
      dotCurrentSize: 10,
    },
    Table: {
      borderRadiusLG: 12,
    },
    Input: {
      borderRadius: 8,
    },
    Select: {
      borderRadius: 8,
    },
  },
});
