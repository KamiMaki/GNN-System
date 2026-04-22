'use client';

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import ThemeRegistry from '@/components/ThemeRegistry';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return (
        <ThemeRegistry>
            <AuthProvider>
                <ProjectProvider>
                    {children}
                </ProjectProvider>
            </AuthProvider>
        </ThemeRegistry>
    );
}
