'use client';
import * as React from 'react';
import { ConfigProvider, App } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { getTheme } from '@/theme/theme';
import { ColorModeContext } from '@/contexts/ColorModeContext';

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<'light' | 'dark'>('light');

  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
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
            {children}
          </App>
        </ConfigProvider>
      </ColorModeContext.Provider>
    </AntdRegistry>
  );
}
