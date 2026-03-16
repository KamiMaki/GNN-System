'use client';

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import ThemeRegistry from '@/components/ThemeRegistry';
import AuthGuard from '@/components/AuthGuard';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <ThemeRegistry>
            <AuthProvider>
                <AuthGuard>
                    <ProjectProvider>
                        {children}
                    </ProjectProvider>
                </AuthGuard>
            </AuthProvider>
        </ThemeRegistry>
    );
}
