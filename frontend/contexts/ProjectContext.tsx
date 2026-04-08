'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { listProjects, getProject, createProject as apiCreateProject, ProjectSummary, ProjectDetail } from '@/lib/api';

interface ProjectContextType {
    projects: ProjectSummary[];
    currentProject: ProjectDetail | null;
    loading: boolean;
    refreshProjects: () => Promise<void>;
    selectProject: (projectId: string) => Promise<void>;
    createNewProject: (name: string, tags: string[]) => Promise<ProjectSummary>;
    clearCurrentProject: () => void;
}

const ProjectContext = createContext<ProjectContextType>({
    projects: [],
    currentProject: null,
    loading: false,
    refreshProjects: async () => { },
    selectProject: async () => { },
    createNewProject: async () => ({ project_id: '', name: '', tags: [], created_at: '', current_step: 1, status: 'created' }),
    clearCurrentProject: () => { },
});

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children }: { children: React.ReactNode }) => {
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [currentProject, setCurrentProject] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(false);

    const refreshProjects = useCallback(async () => {
        try {
            setLoading(true);
            const result = await listProjects();
            setProjects(result);
        } catch (err) {
            console.error('Failed to load projects:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const selectProject = useCallback(async (projectId: string) => {
        try {
            setLoading(true);
            const detail = await getProject(projectId);
            setCurrentProject(detail);
        } catch (err) {
            console.error('Failed to load project:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const createNewProject = useCallback(async (name: string, tags: string[]) => {
        const project = await apiCreateProject(name, tags);
        setProjects(prev => [project, ...prev]);
        return project;
    }, []);

    const clearCurrentProject = useCallback(() => {
        setCurrentProject(null);
    }, []);

    // Load projects on mount
    useEffect(() => {
        refreshProjects();
    }, [refreshProjects]);

    return (
        <ProjectContext.Provider value={{
            projects,
            currentProject,
            loading,
            refreshProjects,
            selectProject,
            createNewProject,
            clearCurrentProject,
        }}>
            {children}
        </ProjectContext.Provider>
    );
};
