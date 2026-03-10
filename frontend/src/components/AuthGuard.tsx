'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Spin } from 'antd';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, initialized } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (initialized && !user && pathname !== '/login') {
            router.replace('/login');
        }
    }, [initialized, user, pathname, router]);

    if (!initialized) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!user && pathname !== '/login') {
        return null;
    }

    return <>{children}</>;
}
