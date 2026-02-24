'use client';
import * as React from 'react';

export const ColorModeContext = React.createContext({
    toggleColorMode: () => { },
    mode: 'light' as 'light' | 'dark',
});
