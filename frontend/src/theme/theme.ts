// src/theme/theme.ts
'use client';
import { createTheme, ThemeOptions, PaletteMode } from '@mui/material/styles';

// --- Dark Theme Constants ---
const neonPrimary = '#00f2ff';
const neonSecondary = '#7000ff';
const glassBackgroundDark = 'rgba(15, 23, 42, 0.6)';
const bgDark = '#0f172a';

// --- Light Theme Constants ---
const lightPrimary = '#0891b2'; // Darker cyan for light mode
const lightSecondary = '#7c3aed';
const glassBackgroundLight = 'rgba(255, 255, 255, 0.7)';
const bgLight = '#f1f5f9';

const getDesignTokens = (mode: PaletteMode): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === 'dark'
      ? {
        // Dark Mode Palette
        primary: {
          main: neonPrimary,
          contrastText: '#000',
        },
        secondary: {
          main: neonSecondary,
        },
        background: {
          default: 'transparent', // Handled by global CSS (or RootLayout)
          paper: glassBackgroundDark,
        },
        text: {
          primary: '#f8fafc',
          secondary: '#94a3b8',
        },
      }
      : {
        // Light Mode Palette
        primary: {
          main: lightPrimary,
          contrastText: '#fff',
        },
        secondary: {
          main: lightSecondary,
        },
        background: {
          default: bgLight,
          paper: glassBackgroundLight,
        },
        text: {
          primary: '#1e293b', // Slate 800
          secondary: '#64748b', // Slate 500
        },
      }),
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(20px)',
          border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.05)',
          boxShadow: mode === 'dark' ? '0 4px 30px rgba(0, 0, 0, 0.2)' : '0 4px 30px rgba(0, 0, 0, 0.05)',
          transition: 'all 0.3s ease-in-out',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '30px',
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: mode === 'dark'
            ? `linear-gradient(135deg, ${glassBackgroundDark} 0%, rgba(20, 30, 50, 0.7) 100%)`
            : `linear-gradient(135deg, ${glassBackgroundLight} 0%, rgba(241, 245, 249, 0.8) 100%)`,
          '&:hover': {
            borderColor: mode === 'dark' ? 'rgba(0, 242, 255, 0.3)' : 'rgba(8, 145, 178, 0.3)',
            boxShadow: mode === 'dark' ? '0 0 25px rgba(0, 242, 255, 0.1)' : '0 0 25px rgba(8, 145, 178, 0.1)',
          },
        },
      },
    },
  },
});

export const getTheme = (mode: PaletteMode) => createTheme(getDesignTokens(mode));