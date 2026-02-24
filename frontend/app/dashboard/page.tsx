'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Button, Input, Card, Tag, Modal, Space, Spin, Avatar, Dropdown, Divider, Row, Col, Typography, Empty,
} from 'antd';
import {
    PlusOutlined, SearchOutlined, FolderOutlined, AppstoreOutlined,
    DeleteOutlined, UserOutlined, SettingOutlined, LogoutOutlined,
} from '@ant-design/icons';

import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { deleteProject, ProjectSummary } from '@/lib/api';

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
    const { user, logout } = useAuth();

    const [search, setSearch] = useState('');
    const [tagFilter, setTagFilter] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newTags, setNewTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [creating, setCreating] = useState(false);

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

    const userMenuItems = user ? {
        items: [
            { key: 'header', label: <div><div style={{ fontWeight: 700 }}>{user.name}</div><div style={{ fontSize: 12, opacity: 0.6 }}>{user.email}</div></div>, disabled: true },
            { type: 'divider' as const },
            { key: 'profile', label: 'Profile', icon: <UserOutlined /> },
            { key: 'settings', label: 'Settings', icon: <SettingOutlined /> },
            { type: 'divider' as const },
            { key: 'logout', label: 'Logout', icon: <LogoutOutlined />, danger: true },
        ],
        onClick: ({ key }: { key: string }) => {
            if (key === 'logout') logout();
        },
    } : { items: [] };

    return (
        <div>
            {/* Header */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
            }}>
                <Button
                    type="text"
                    icon={<AppstoreOutlined />}
                    onClick={() => router.push('/dashboard')}
                    style={{ fontWeight: 800, fontSize: '1rem' }}
                >
                    LayoutXpert
                </Button>
                <Text type="secondary">PROJECT WORKSPACE</Text>
                <div style={{ flex: 1 }} />
                {user && (
                    <Dropdown menu={userMenuItems} trigger={['click']} placement="bottomRight">
                        <Avatar
                            src={user.avatar}
                            alt={user.name}
                            size={32}
                            style={{ cursor: 'pointer' }}
                            icon={<UserOutlined />}
                        />
                    </Dropdown>
                )}
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
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
                        <Spin size="large" />
                    </div>
                ) : filtered.length === 0 ? (
                    <Empty
                        image={<FolderOutlined style={{ fontSize: 64, opacity: 0.3 }} />}
                        description={
                            <Space direction="vertical" size={4}>
                                <Text type="secondary">
                                    {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {projects.length === 0 ? 'Create your first project to get started.' : 'Try adjusting your search or filters.'}
                                </Text>
                            </Space>
                        }
                    />
                ) : (
                    <Row gutter={[24, 24]}>
                        {filtered.map((project) => (
                            <Col xs={24} sm={12} md={8} key={project.project_id}>
                                <Card
                                    hoverable
                                    onClick={() => router.push(getStepPath(project))}
                                    styles={{ body: { padding: 20 } }}
                                    extra={
                                        <Button
                                            type="text"
                                            danger
                                            size="small"
                                            icon={<DeleteOutlined />}
                                            onClick={(e) => handleDelete(e, project.project_id)}
                                        />
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
                                            {new Date(project.created_at).toLocaleDateString()}
                                        </Text>
                                    </div>

                                    {/* Step progress */}
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {STEP_LABELS.map((label, i) => (
                                            <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                                                <div style={{
                                                    height: 3, borderRadius: 2, marginBottom: 4,
                                                    background: i < project.current_step ? '#1677ff' : '#f0f0f0',
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
        </div>
    );
}
