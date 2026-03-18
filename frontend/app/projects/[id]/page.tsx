'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Button, Card, Tag, Table, Space, Typography, Row, Col, Statistic, Empty, Spin, theme,
} from 'antd';
import {
    CloudUploadOutlined, ExperimentOutlined, RocketOutlined,
    BarChartOutlined, DatabaseOutlined, PlayCircleOutlined,
    EyeOutlined, ClockCircleOutlined, CheckCircleOutlined,
    CloseCircleOutlined, LoadingOutlined,
} from '@ant-design/icons';

import {
    getProject, listExperiments, ProjectDetail, TaskStatus, DatasetSummary,
} from '@/lib/api';
import PageTransition from '@/components/PageTransition';
import { sanitizeRouteParam } from '@/lib/sanitize';

const { Title, Text } = Typography;

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

function formatDuration(startedAt?: string, completedAt?: string): string {
    if (!startedAt) return '-';
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const secs = Math.floor((end - start) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs}s`;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
    COMPLETED: <CheckCircleOutlined style={{ color: '#10b981' }} />,
    FAILED: <CloseCircleOutlined style={{ color: '#ef4444' }} />,
    TRAINING: <LoadingOutlined style={{ color: '#0891b2' }} />,
    QUEUED: <ClockCircleOutlined style={{ color: '#f59e0b' }} />,
    PREPROCESSING: <LoadingOutlined style={{ color: '#06b6d4' }} />,
};

const STATUS_COLOR: Record<string, string> = {
    COMPLETED: 'green',
    FAILED: 'red',
    TRAINING: 'processing',
    QUEUED: 'warning',
    PREPROCESSING: 'processing',
};

export default function ProjectOverviewPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = sanitizeRouteParam(params.id);
    const { token } = theme.useToken();

    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [experiments, setExperiments] = useState<TaskStatus[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!projectId) return;
        try {
            const [proj, exps] = await Promise.all([
                getProject(projectId),
                listExperiments(projectId).catch(() => []),
            ]);
            setProject(proj);
            setExperiments(exps);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // Poll for active training runs
    useEffect(() => {
        const hasActive = experiments.some(e => e.status === 'TRAINING' || e.status === 'QUEUED' || e.status === 'PREPROCESSING');
        if (!hasActive) return;
        const interval = setInterval(refresh, 3000);
        return () => clearInterval(interval);
    }, [experiments, refresh]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!project) return null;

    const ds = project.dataset_summary;
    const completedRuns = experiments.filter(e => e.status === 'COMPLETED');
    const bestRun = completedRuns.length > 0
        ? completedRuns.reduce((best, run) => {
            const bestMetric = best.results?.test_metrics?.accuracy ?? best.results?.test_metrics?.r2_score ?? 0;
            const runMetric = run.results?.test_metrics?.accuracy ?? run.results?.test_metrics?.r2_score ?? 0;
            return (runMetric ?? 0) > (bestMetric ?? 0) ? run : best;
        })
        : null;

    const experimentColumns = [
        {
            title: '#',
            key: 'index',
            width: 50,
            render: (_: unknown, __: unknown, index: number) => (
                <Text type="secondary">{experiments.length - index}</Text>
            ),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 130,
            render: (status: string) => (
                <Space size={6}>
                    {STATUS_ICON[status]}
                    <Tag color={STATUS_COLOR[status] || 'default'}>{status}</Tag>
                </Space>
            ),
        },
        {
            title: 'Best Model',
            key: 'model',
            render: (_: unknown, record: TaskStatus) => (
                <Text>{record.best_config?.model_name || '-'}</Text>
            ),
        },
        {
            title: 'Metric',
            key: 'metric',
            render: (_: unknown, record: TaskStatus) => {
                if (!record.results) return <Text type="secondary">-</Text>;
                const acc = record.results.test_metrics?.accuracy;
                const r2 = record.results.test_metrics?.r2_score;
                if (acc != null) return <Text strong>{(acc * 100).toFixed(1)}% acc</Text>;
                if (r2 != null) return <Text strong>R²={r2.toFixed(3)}</Text>;
                return <Text type="secondary">-</Text>;
            },
        },
        {
            title: 'Trials',
            key: 'trials',
            width: 80,
            render: (_: unknown, record: TaskStatus) => (
                <Text type="secondary">{record.current_trial ?? 0}/{record.total_trials ?? '-'}</Text>
            ),
        },
        {
            title: 'Duration',
            key: 'duration',
            width: 100,
            render: (_: unknown, record: TaskStatus) => (
                <Text type="secondary">{formatDuration(record.started_at, record.completed_at)}</Text>
            ),
        },
        {
            title: 'Started',
            key: 'started',
            width: 120,
            render: (_: unknown, record: TaskStatus) => (
                <Text type="secondary" style={{ fontSize: 12 }}>
                    {record.started_at ? timeAgo(record.started_at) : '-'}
                </Text>
            ),
        },
        {
            title: '',
            key: 'action',
            width: 80,
            render: (_: unknown, record: TaskStatus) => (
                record.status === 'COMPLETED' ? (
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => router.push(`/projects/${projectId}/evaluate?task_id=${record.task_id}`)}
                    >
                        View
                    </Button>
                ) : null
            ),
        },
    ];

    const nextStepPath = (() => {
        if (!ds) return `/projects/${projectId}/upload`;
        if (project.current_step <= 2) return `/projects/${projectId}/explore`;
        return `/projects/${projectId}/train`;
    })();

    const nextStepLabel = (() => {
        if (!ds) return 'Upload Data';
        if (project.current_step <= 2) return 'Explore Data';
        return 'Start Training';
    })();

    const nextStepIcon = (() => {
        if (!ds) return <CloudUploadOutlined />;
        if (project.current_step <= 2) return <BarChartOutlined />;
        return <RocketOutlined />;
    })();

    return (
        <PageTransition>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
                {/* Project title section */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 24,
                }}>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>{project.name}</Title>
                        <Space size={8} style={{ marginTop: 8 }}>
                            <Tag color={
                                project.status === 'completed' ? 'green' :
                                project.status === 'training' ? 'processing' :
                                project.status === 'failed' ? 'red' : 'default'
                            }>
                                {project.status.replace('_', ' ').toUpperCase()}
                            </Tag>
                            {project.tags?.map(tag => (
                                <Tag key={tag}>{tag}</Tag>
                            ))}
                        </Space>
                    </div>
                    <Button
                        type="primary"
                        size="large"
                        icon={nextStepIcon}
                        onClick={() => router.push(nextStepPath)}
                    >
                        {nextStepLabel}
                    </Button>
                </div>

                {/* Stats row */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={12} sm={6}>
                        <Card size="small">
                            <Statistic
                                title="Training Runs"
                                value={experiments.length}
                                prefix={<ExperimentOutlined />}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                        <Card size="small">
                            <Statistic
                                title="Completed"
                                value={completedRuns.length}
                                prefix={<CheckCircleOutlined style={{ color: token.colorSuccess }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                        <Card size="small">
                            <Statistic
                                title="Best Accuracy"
                                value={bestRun?.results?.test_metrics?.accuracy != null
                                    ? `${(bestRun.results.test_metrics.accuracy * 100).toFixed(1)}%`
                                    : bestRun?.results?.test_metrics?.r2_score != null
                                    ? `R²=${bestRun.results.test_metrics.r2_score.toFixed(3)}`
                                    : '-'
                                }
                                prefix={<RocketOutlined style={{ color: token.colorPrimary }} />}
                            />
                        </Card>
                    </Col>
                    <Col xs={12} sm={6}>
                        <Card size="small">
                            <Statistic
                                title="Best Model"
                                value={bestRun?.best_config?.model_name || '-'}
                                prefix={<BarChartOutlined style={{ color: token.colorInfo }} />}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* Dataset Section */}
                <Card
                    title={
                        <Space>
                            <DatabaseOutlined />
                            <span>Dataset</span>
                        </Space>
                    }
                    style={{ marginBottom: 24 }}
                    extra={
                        ds ? (
                            <Space>
                                <Button
                                    size="small"
                                    icon={<BarChartOutlined />}
                                    onClick={() => router.push(`/projects/${projectId}/explore`)}
                                >
                                    Explore
                                </Button>
                                <Button
                                    size="small"
                                    icon={<CloudUploadOutlined />}
                                    onClick={() => router.push(`/projects/${projectId}/upload`)}
                                >
                                    Re-upload
                                </Button>
                            </Space>
                        ) : null
                    }
                >
                    {ds ? (
                        <Row gutter={[24, 16]}>
                            <Col xs={24} sm={8}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Name</Text>
                                <div><Text strong>{ds.name}</Text></div>
                            </Col>
                            <Col xs={12} sm={4}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Nodes</Text>
                                <div><Text strong>{ds.num_nodes.toLocaleString()}</Text></div>
                            </Col>
                            <Col xs={12} sm={4}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Edges</Text>
                                <div><Text strong>{ds.num_edges.toLocaleString()}</Text></div>
                            </Col>
                            <Col xs={12} sm={4}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Features</Text>
                                <div><Text strong>{ds.num_features}</Text></div>
                            </Col>
                            <Col xs={12} sm={4}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Task Type</Text>
                                <div>
                                    <Tag color="cyan">
                                        {project.task_type?.replace('_', ' ') || ds.task_type?.replace('_', ' ') || 'pending'}
                                    </Tag>
                                </div>
                            </Col>
                            {project.label_column && (
                                <Col xs={12} sm={4}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Label</Text>
                                    <div><Tag color="green">{project.label_column}</Tag></div>
                                </Col>
                            )}
                        </Row>
                    ) : (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="No dataset uploaded yet"
                        >
                            <Button
                                type="primary"
                                icon={<CloudUploadOutlined />}
                                onClick={() => router.push(`/projects/${projectId}/upload`)}
                            >
                                Upload Data
                            </Button>
                        </Empty>
                    )}
                </Card>

                {/* Training Runs Section */}
                <Card
                    title={
                        <Space>
                            <ExperimentOutlined />
                            <span>Training Runs</span>
                            {experiments.length > 0 && (
                                <Tag>{experiments.length}</Tag>
                            )}
                        </Space>
                    }
                    extra={
                        project.current_step >= 3 ? (
                            <Button
                                type="primary"
                                icon={<PlayCircleOutlined />}
                                onClick={() => router.push(`/projects/${projectId}/train`)}
                            >
                                New Training
                            </Button>
                        ) : null
                    }
                >
                    {experiments.length > 0 ? (
                        <Table
                            dataSource={[...experiments].reverse()}
                            columns={experimentColumns}
                            rowKey="task_id"
                            pagination={experiments.length > 10 ? { pageSize: 10 } : false}
                            size="small"
                        />
                    ) : (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                project.current_step < 3
                                    ? 'Complete data setup before training'
                                    : 'No training runs yet'
                            }
                        >
                            {project.current_step >= 3 && (
                                <Button
                                    type="primary"
                                    icon={<RocketOutlined />}
                                    onClick={() => router.push(`/projects/${projectId}/train`)}
                                >
                                    Start First Training
                                </Button>
                            )}
                        </Empty>
                    )}
                </Card>

                {/* Quick Navigation */}
                <Card size="small" style={{ marginTop: 24 }}>
                    <Space size="middle" wrap>
                        <Text type="secondary">Quick navigation:</Text>
                        <Button
                            size="small"
                            icon={<CloudUploadOutlined />}
                            onClick={() => router.push(`/projects/${projectId}/upload`)}
                        >
                            Upload
                        </Button>
                        <Button
                            size="small"
                            icon={<BarChartOutlined />}
                            disabled={!ds}
                            onClick={() => router.push(`/projects/${projectId}/explore`)}
                        >
                            Explore
                        </Button>
                        <Button
                            size="small"
                            icon={<RocketOutlined />}
                            disabled={project.current_step < 3}
                            onClick={() => router.push(`/projects/${projectId}/train`)}
                        >
                            Train
                        </Button>
                        <Button
                            size="small"
                            icon={<BarChartOutlined />}
                            disabled={completedRuns.length === 0}
                            onClick={() => router.push(`/projects/${projectId}/evaluate`)}
                        >
                            Evaluate
                        </Button>
                    </Space>
                </Card>
            </div>
        </PageTransition>
    );
}
