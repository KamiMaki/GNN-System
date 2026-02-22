'use client';

import React, { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import PipelineStepper from '@/components/PipelineStepper';
import { getProject, ProjectDetail } from '@/lib/api';

const COLORS = {
    bg: '#020617',
    cyan: '#06b6d4',
};

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const projectId = params.id as string;
    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(true);

    // Re-fetch project on route change to keep stepper in sync
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
            <Box sx={{ minHeight: '100vh', bgcolor: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress sx={{ color: COLORS.cyan }} />
            </Box>
        );
    }

    if (!project) {
        return (
            <Box sx={{ minHeight: '100vh', bgcolor: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                Project not found.
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: COLORS.bg }}>
            <PipelineStepper
                currentStep={project.current_step}
                projectName={project.name}
                projectId={projectId}
                status={project.status}
            />
            {children}
        </Box>
    );
}
