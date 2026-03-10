'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Button, Input, Card, Tag, Modal, Space, Skeleton, Row, Col, Typography, Empty, theme,
} from 'antd';
import {
    PlusOutlined, SearchOutlined, DeleteOutlined, EditOutlined,
    ExperimentOutlined, RocketOutlined, CheckCircleOutlined,
} from '@ant-design/icons';

import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { deleteProject, updateProject, ProjectSummary } from '@/lib/api';
import AppHeader from '@/components/AppHeader';
import PageTransition from '@/components/PageTransition';

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

const { Title, Text } = Typography;

const STEP_LABELS = ['Upload', 'Analysis', 'Training', 'Evaluation'];

const STATUS_TAG_COLOR: Record<string, string> = {
    created: 'default',
    data_uploaded: 'blue',
    data_confirmed: 'purple',
    training: 'processing',
    completed: 'green',
    failed: 'red',
};

function getStepPath(project: ProjectSummary): string {
    const step = project.current_step;
    const id = project.project_id;
    if (project.status === 'completed') return `/projects/${id}/evaluate`;
    if (step <= 1 && project.status === 'created') return `/projects/${id}/upload`;
    if (step <= 2) return `/projects/${id}/explore`;
    if (step <= 3) return `/projects/${id}/train`;
    return `/projects/${id}/evaluate`;
}

export default function DashboardPage() {
    const router = useRouter();
    const { projects, loading, createNewProject, refreshProjects } = useProject();
    const { user } = useAuth();
    const { token } = theme.useToken();

    const [search, setSearch] = useState('');
    const [tagFilter, setTagFilter] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newTags, setNewTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [creating, setCreating] = useState(false);
    const [editProject, setEditProject] = useState<ProjectSummary | null>(null);
    const [editName, setEditName] = useState('');
    const [saving, setSaving] = useState(false);

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        projects.forEach(p => p.tags?.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [projects]);

    const filtered = useMemo(() => {
        let result = projects;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.tags?.some(t => t.toLowerCase().includes(q))
            );
        }
        if (tagFilter) {
            result = result.filter(p => p.tags?.includes(tagFilter));
        }
        return result;
    }, [projects, search, tagFilter]);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const project = await createNewProject(newName.trim(), newTags);
            setDialogOpen(false);
            setNewName('');
            setNewTags([]);
            router.push(`/projects/${project.project_id}/upload`);
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const handleTagAdd = () => {
        const tag = tagInput.trim();
        if (tag && !newTags.includes(tag)) {
            setNewTags([...newTags, tag]);
        }
        setTagInput('');
    };

    const handleDelete = async (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        if (!confirm('Delete this project?')) return;
        try {
            await deleteProject(projectId);
            refreshProjects();
        } catch (err) {
            console.error(err);
        }
    };

    const handleEditOpen = (e: React.MouseEvent, project: ProjectSummary) => {
        e.stopPropagation();
        setEditProject(project);
        setEditName(project.name);
    };

    const handleSaveEdit = async () => {
        if (!editProject || !editName.trim()) return;
        setSaving(true);
        try {
            await updateProject(editProject.project_id, { name: editName.trim() });
            refreshProjects();
            setEditProject(null);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const completedCount = projects.filter(p => p.status === 'completed').length;
    const trainingCount = projects.filter(p => p.status === 'training').length;

    return (
        <div>
            <AppHeader subtitle="PROJECT WORKSPACE" />

            <PageTransition>
            {/* Hero / Welcome Banner */}
            <div style={{
                background: `linear-gradient(135deg, ${token.colorPrimary}12 0%, ${token.colorPrimary}06 50%, transparent 100%)`,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                padding: '32px 24px',
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <Row gutter={24} align="middle">
                        <Col flex="auto">
                            <Title level={3} style={{ margin: 0 }}>
                                Welcome back{user ? `, ${user.name.split(' ')[0]}` : ''}
                            </Title>
                            <Text type="secondary" style={{ fontSize: 14, marginTop: 4, display: 'block' }}>
                                Manage your GNN training projects and experiments
                            </Text>
                        </Col>
                        <Col>
                            <Space size="large">
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: token.colorPrimary }}>{projects.length}</div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        <ExperimentOutlined style={{ marginRight: 4 }} />Projects
                                    </Text>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: token.colorSuccess }}>{completedCount}</div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        <CheckCircleOutlined style={{ marginRight: 4 }} />Completed
                                    </Text>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: token.colorWarning }}>{trainingCount}</div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        <RocketOutlined style={{ marginRight: 4 }} />Training
                                    </Text>
                                </div>
                            </Space>
                        </Col>
                    </Row>
                </div>
            </div>

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                    <Input
                        placeholder="Search projects..."
                        prefix={<SearchOutlined />}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ maxWidth: 400, flex: 1 }}
                    />

                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                        {tagFilter && (
                            <Tag closable onClose={() => setTagFilter(null)} color="blue">
                                Tag: {tagFilter}
                            </Tag>
                        )}
                        {allTags.slice(0, 8).map(tag => (
                            <Tag
                                key={tag}
                                color={tagFilter === tag ? 'blue' : undefined}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                            >
                                {tag}
                            </Tag>
                        ))}
                    </div>

                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setDialogOpen(true)}
                    >
                        New Project
                    </Button>
                </div>

                {/* Project Grid */}
                {loading && projects.length === 0 ? (
                    <Row gutter={[24, 24]}>
                        {[1, 2, 3].map(i => (
                            <Col xs={24} sm={12} md={8} key={i}>
                                <Card>
                                    <Skeleton active paragraph={{ rows: 3 }} />
                                </Card>
                            </Col>
                        ))}
                    </Row>
                ) : filtered.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <Space direction="vertical" size={4}>
                                <Text strong>
                                    {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 13 }}>
                                    {projects.length === 0
                                        ? 'Create your first project to start training GNN models'
                                        : 'Try adjusting your search or tag filters'}
                                </Text>
                            </Space>
                        }
                    >
                        {projects.length === 0 && (
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialogOpen(true)}>
                                Create First Project
                            </Button>
                        )}
                    </Empty>
                ) : (
                    <Row gutter={[24, 24]}>
                        {filtered.map((project) => (
                            <Col xs={24} sm={12} md={8} key={project.project_id}>
                                <Card
                                    hoverable
                                    onClick={() => router.push(getStepPath(project))}
                                    styles={{
                                        body: { padding: 20 },
                                    }}
                                    style={{
                                        borderTop: `3px solid ${STATUS_TAG_COLOR[project.status] === 'green' ? token.colorSuccess : STATUS_TAG_COLOR[project.status] === 'processing' ? token.colorWarning : token.colorPrimary}`,
                                    }}
                                    extra={
                                        <Space size={4}>
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<EditOutlined />}
                                                onClick={(e) => handleEditOpen(e, project)}
                                            />
                                            <Button
                                                type="text"
                                                danger
                                                size="small"
                                                icon={<DeleteOutlined />}
                                                onClick={(e) => handleDelete(e, project.project_id)}
                                            />
                                        </Space>
                                    }
                                    title={<Text strong ellipsis style={{ maxWidth: 200 }}>{project.name}</Text>}
                                >
                                    {/* Tags */}
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12, minHeight: 24 }}>
                                        {project.tags?.slice(0, 3).map(tag => (
                                            <Tag key={tag}>{tag}</Tag>
                                        ))}
                                    </div>

                                    {/* Status & Date */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <Tag color={STATUS_TAG_COLOR[project.status] || 'default'}>
                                            {project.status.replace('_', ' ').toUpperCase()}
                                        </Tag>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {timeAgo(project.updated_at || project.created_at)}
                                        </Text>
                                    </div>

                                    {/* Step progress */}
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {STEP_LABELS.map((label, i) => (
                                            <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                                                <div style={{
                                                    height: 3, borderRadius: 2, marginBottom: 4,
                                                    background: i < project.current_step
                                                        ? `linear-gradient(90deg, ${token.colorPrimary}, ${token.colorPrimaryBg})`
                                                        : token.colorFillSecondary,
                                                }} />
                                                <Text type="secondary" style={{ fontSize: 10 }}>{label}</Text>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                )}
            </div>

            {/* Create Project Modal */}
            <Modal
                title="Create New Project"
                open={dialogOpen}
                onCancel={() => setDialogOpen(false)}
                onOk={handleCreate}
                okText={creating ? 'Creating...' : 'Create'}
                okButtonProps={{ disabled: !newName.trim() || creating, loading: creating }}
            >
                <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
                    <Input
                        placeholder="Project Name"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        autoFocus
                    />
                    <div>
                        <Input
                            placeholder="Add Tags (press Enter)"
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleTagAdd(); } }}
                        />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                            {newTags.map(tag => (
                                <Tag key={tag} closable onClose={() => setNewTags(newTags.filter(t => t !== tag))} color="blue">
                                    {tag}
                                </Tag>
                            ))}
                        </div>
                    </div>
                </Space>
            </Modal>

            {/* Edit Project Modal */}
            <Modal
                title="Rename Project"
                open={!!editProject}
                onCancel={() => setEditProject(null)}
                onOk={handleSaveEdit}
                okText={saving ? 'Saving...' : 'Save'}
                okButtonProps={{ disabled: !editName.trim() || saving, loading: saving }}
            >
                <Input
                    placeholder="Project Name"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); }}
                    autoFocus
                    style={{ marginTop: 16 }}
                />
            </Modal>
            </PageTransition>
        </div>
    );
}
