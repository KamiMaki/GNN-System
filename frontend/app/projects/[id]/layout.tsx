'use client';

import React, { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { Skeleton } from 'antd';
import PipelineStepper from '@/components/PipelineStepper';
import { getProject, ProjectDetail } from '@/lib/api';
import { sanitizeParam } from '@/lib/sanitize';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const projectId = sanitizeParam(params.id);
    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId) return;
        let cancelled = false;
        getProject(projectId)
            .then(data => { if (!cancelled) setProject(data); })
            .catch(console.error)
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [projectId, pathname]);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh' }}>
                <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <Skeleton.Input active style={{ width: 600 }} />
                </div>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
                    <Skeleton active paragraph={{ rows: 8 }} />
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Project not found.
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh' }}>
            <PipelineStepper
                currentStep={project.current_step}
                projectName={project.name}
                projectId={projectId}
                status={project.status}
            />
            {children}
        </div>
    );
}
