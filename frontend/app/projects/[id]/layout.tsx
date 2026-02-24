'use client';

import React, { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { Spin } from 'antd';
import PipelineStepper from '@/components/PipelineStepper';
import { getProject, ProjectDetail } from '@/lib/api';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const projectId = params.id as string;
    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId) return;
        setLoading(true);
        getProject(projectId)
            .then(setProject)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [projectId, pathname]);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin size="large" />
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
