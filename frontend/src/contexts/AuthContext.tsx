'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { isKeycloakMode } from '@/lib/auth-mode';

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

// ── Keycloak mode: delegates to NextAuth session ──

function KeycloakAuthProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();

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
}

// ── Mock mode: existing localStorage-based auth ──

function MockAuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const router = useRouter();

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('mock_user');
            if (storedUser) {
                const parsed: unknown = JSON.parse(storedUser);
                if (
                    parsed &&
                    typeof parsed === 'object' &&
                    typeof (parsed as Record<string, unknown>).id === 'string' &&
                    typeof (parsed as Record<string, unknown>).name === 'string' &&
                    typeof (parsed as Record<string, unknown>).email === 'string'
                ) {
                    setUser(parsed as User);
                } else {
                    localStorage.removeItem('mock_user');
                }
            }
        } catch {
            localStorage.removeItem('mock_user');
        }
        setInitialized(true);
    }, []);

    const login = async () => {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const mockUser: User = {
            id: 'u_001',
            name: 'Alex Chen',
            email: 'alex.chen@chip-design.com',
            role: '',
            avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d'
        };

        setUser(mockUser);
        localStorage.setItem('mock_user', JSON.stringify(mockUser));
        setIsLoading(false);
        router.push('/dashboard');
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('mock_user');
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, initialized, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// ── Unified provider: picks based on AUTH_MODE ──

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    if (isKeycloakMode) {
        return <KeycloakAuthProvider>{children}</KeycloakAuthProvider>;
    }
    return <MockAuthProvider>{children}</MockAuthProvider>;
};
