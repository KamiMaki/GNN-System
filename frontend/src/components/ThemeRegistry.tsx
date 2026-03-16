'use client';
import * as React from 'react';
import { ConfigProvider, App, theme as antdTheme } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { getTheme } from '@/theme/theme';
import { ColorModeContext } from '@/contexts/ColorModeContext';

/** Syncs <body> background/text color with the active Ant Design theme token */
function BodyStyleSync() {
  const { token } = antdTheme.useToken();

  React.useEffect(() => {
    document.body.style.backgroundColor = token.colorBgContainer;
    document.body.style.color = token.colorText;
  }, [token.colorBgContainer, token.colorText]);

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
            <BodyStyleSync />
            {children}
          </App>
        </ConfigProvider>
      </ColorModeContext.Provider>
    </AntdRegistry>
  );
}
