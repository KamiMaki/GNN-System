'use client';
import * as React from 'react';

export const ColorModeContext = React.createContext({
    toggleColorMode: () => { },
    mode: 'dark' as 'light' | 'dark',
});
