'use client';

import React from 'react';
import AppHeader from '@/components/AppHeader';

interface PipelineStepperProps {
    currentStep: number;
    projectName: string;
    projectId: string;
    status?: string;
}

export default function PipelineStepper({ currentStep, projectName, projectId, status }: PipelineStepperProps) {
    return (
        <AppHeader
            projectName={projectName}
            projectId={projectId}
            projectStep={currentStep}
            projectStatus={status}
        />
    );
}
