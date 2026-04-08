'use client';

import React, { createContext, useContext } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

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

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: false,
    initialized: false,
    login: async () => { },
    logout: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const { data: session, status } = useSession();

    const user: User | null = session?.user
        ? {
              id: session.user.id ?? '',
              name: session.user.name ?? '',
              email: session.user.email ?? '',
              role: (session.user as Record<string, unknown>).role as string ?? '',
              avatar: session.user.image ?? undefined,
          }
        : null;

    const login = async () => {
        await signIn('keycloak');
    };

    const logout = () => {
        signOut({ redirectTo: '/login' });
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading: status === 'loading',
                initialized: status !== 'loading',
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
