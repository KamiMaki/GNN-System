'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import ThemeRegistry from '@/components/ThemeRegistry';
import AuthGuard from '@/components/AuthGuard';
import { isKeycloakMode } from '@/lib/auth-mode';

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
    const inner = (
        <ThemeRegistry>
            <AuthStack>{children}</AuthStack>
        </ThemeRegistry>
    );

    // SessionProvider is required for useSession() in keycloak mode
    if (isKeycloakMode) {
        return <SessionProvider>{inner}</SessionProvider>;
    }

    return inner;
}
