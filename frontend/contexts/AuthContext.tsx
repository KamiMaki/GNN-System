'use client';

import React, { createContext, useContext } from 'react';

/**
 * Auth has been removed from this build — the dashboard is directly
 * accessible. This context is kept as a no-op stub so existing components
 * (AppHeader, dashboard) that call `useAuth()` continue to compile.
 */

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    initialized: boolean;
    login: () => Promise<void>;
    logout: () => void;
}

const GUEST_USER: User = {
    id: 'guest',
    name: 'Guest',
    email: '',
    role: 'user',
};

const AuthContext = createContext<AuthContextType>({
    user: GUEST_USER,
    isLoading: false,
    initialized: true,
    login: async () => { },
    logout: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider
        value={{
            user: GUEST_USER,
            isLoading: false,
            initialized: true,
            login: async () => { },
            logout: () => { },
        }}
    >
        {children}
    </AuthContext.Provider>
);
