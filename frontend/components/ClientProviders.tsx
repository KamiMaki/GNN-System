'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import ThemeRegistry from '@/components/ThemeRegistry';
import AuthGuard from '@/components/AuthGuard';

function AuthStack({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <AuthGuard>
                <ProjectProvider>
                    {children}
                </ProjectProvider>
            </AuthGuard>
        </AuthProvider>
    );
}

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeRegistry>
                <AuthStack>{children}</AuthStack>
            </ThemeRegistry>
        </SessionProvider>
    );
}
