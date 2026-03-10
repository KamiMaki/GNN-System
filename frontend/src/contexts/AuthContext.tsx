'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const router = useRouter();

    // Simulate session check
    useEffect(() => {
        const storedUser = localStorage.getItem('mock_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setInitialized(true);
    }, []);

    const login = async () => {
        setIsLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));

        const mockUser: User = {
            id: 'u_001',
            name: 'Dr. Alex Chen',
            email: 'alex.chen@chip-design.com',
            role: 'Senior IC Architect',
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
};
