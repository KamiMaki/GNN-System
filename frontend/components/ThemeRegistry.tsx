'use client';
import * as React from 'react';
import { ConfigProvider, App, theme as antdTheme } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { getTheme } from '@/theme/theme';
import { ColorModeContext } from '@/contexts/ColorModeContext';

/** Syncs <html> data-theme attribute and <body> background/text color with active theme */
function BodyStyleSync({ mode }: { mode: 'light' | 'dark' }) {
  const { token } = antdTheme.useToken();

  React.useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    // Also toggle .dark class for CSS selectors using that convention
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    document.body.style.backgroundColor = token.colorBgContainer;
    document.body.style.color = token.colorText;
  }, [token.colorBgContainer, token.colorText, mode]);

  return null;
}

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('color_mode') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prev) => {
          const next = prev === 'light' ? 'dark' : 'light';
          localStorage.setItem('color_mode', next);
          return next;
        });
      },
      mode,
    }),
    [mode],
  );

  const themeConfig = React.useMemo(() => getTheme(mode), [mode]);

  return (
    <AntdRegistry>
      <ColorModeContext.Provider value={colorMode}>
        <ConfigProvider theme={themeConfig}>
          <App>
            <BodyStyleSync mode={mode} />
            {children}
          </App>
        </ConfigProvider>
      </ColorModeContext.Provider>
    </AntdRegistry>
  );
}
