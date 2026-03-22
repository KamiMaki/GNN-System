'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Button, Card, Tag, Slider, Switch, Alert, Spin, Space, Table, Tooltip, Progress, Typography, Checkbox, Row, Col, theme,
} from 'antd';
import {
    PlayCircleOutlined, AppstoreOutlined, ClockCircleOutlined,
    CheckCircleOutlined, HistoryOutlined, WarningOutlined, RocketOutlined,
} from '@ant-design/icons';

import {
    estimateTraining, startProjectTraining, getProjectStatus, getProject,
    listExperiments,
    TaskStatus, TrainingEstimate, ProjectDetail,
} from '@/lib/api';

const { Title, Text } = Typography;

const ALL_MODELS = ['gcn', 'gat', 'sage', 'gin', 'mlp'];

function formatTime(seconds: number): string {
    if (seconds < 0) return '\u2014';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

export default function TrainPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const { token } = theme.useToken();

    const [project, setProject] = useState<ProjectDetail | null>(null);

    const [autoMode, setAutoMode] = useState(true);
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [nTrials, setNTrials] = useState(150);
    const [estimate, setEstimate] = useState<TrainingEstimate | null>(null);
    const [estimateLoading, setEstimateLoading] = useState(false);

    const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
    const [training, setTraining] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const logRef = useRef<HTMLDivElement>(null);
    const lastLogKey = useRef<string>('');

    const [elapsed, setElapsed] = useState(0);
    const [experiments, setExperiments] = useState<TaskStatus[]>([]);

    const hasEdgeAttrs = project?.dataset_summary?.has_edge_attrs;

    useEffect(() => {
        if (!projectId) return;
        getProject(projectId).then(p => {
            setProject(p);
            if (p.task_status && p.task_status.status !== 'COMPLETED' && p.task_status.status !== 'FAILED') {
                setTaskStatus(p.task_status);
                setTraining(true);
            } else if (p.task_status) {
                setTaskStatus(p.task_status);
            }
        }).catch(console.error);
        listExperiments(projectId).then(setExperiments).catch(console.error);
    }, [projectId]);

    useEffect(() => {
        if (!projectId) return;
        setEstimateLoading(true);
        estimateTraining(projectId, nTrials)
            .then(setEstimate)
            .catch(console.error)
            .finally(() => setEstimateLoading(false));
    }, [projectId, nTrials]);

    useEffect(() => {
        if (!training || !projectId) return;
        const poll = async () => {
            try {
                const status = await getProjectStatus(projectId);
                setTaskStatus(status);
                const key = `${status.status}|${status.progress}|${status.current_trial}`;
                if (key !== lastLogKey.current) {
                    lastLogKey.current = key;
                    const logLine = `[${new Date().toLocaleTimeString()}] ${status.status} - Progress: ${status.progress}%` +
                        (status.current_trial ? ` (Trial ${status.current_trial}/${status.total_trials})` : '');
                    setLogs(prev => [...prev, logLine]);
                }
                if (status.status === 'COMPLETED') {
                    setTraining(false);
                    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Training completed!`]);
                    listExperiments(projectId).then(setExperiments).catch(console.error);
                } else if (status.status === 'FAILED') {
                    setTraining(false);
                    setError('Training failed. Check logs for details.');
                    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Training FAILED`]);
                    listExperiments(projectId).then(setExperiments).catch(console.error);
                }
            } catch (err) {
                console.error(err);
            }
        };
        pollRef.current = setInterval(poll, 2000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [training, projectId]);

    useEffect(() => {
        const startedAt = taskStatus?.started_at;
        if (!startedAt || (!training && taskStatus?.status !== 'COMPLETED')) return;
        if (taskStatus?.status === 'COMPLETED' && taskStatus?.results) {
            setElapsed(taskStatus.results.training_time_seconds);
            return;
        }
        const startTime = new Date(startedAt).getTime();
        const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [taskStatus?.started_at, training, taskStatus?.status]);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logs]);

    const handleStart = async () => {
        setError(null);
        setLogs([`[${new Date().toLocaleTimeString()}] Starting training...`]);
        lastLogKey.current = '';
        try {
            const models = autoMode ? [] : selectedModels;
            const status = await startProjectTraining(projectId, models, nTrials);
            setTaskStatus(status);
            setTraining(true);
        } catch (err: any) {
            setError(err.message || 'Failed to start training');
        }
    };

    const isCompleted = taskStatus?.status === 'COMPLETED';
    const isFailed = taskStatus?.status === 'FAILED';
    const isRunning = training && !isCompleted && !isFailed;

    const progress = taskStatus?.progress || 0;
    const estimatedRemaining = progress > 0 && isRunning
        ? Math.max(0, elapsed * (100 - progress) / progress)
        : -1;

    const showEdgeAttrWarning = hasEdgeAttrs && !autoMode && selectedModels.includes('mlp');

    const experimentColumns = [
        { title: '#', dataIndex: 'index', key: 'index', width: 50 },
        { title: 'Model', dataIndex: 'model', key: 'model' },
        {
            title: 'Status', dataIndex: 'status', key: 'status',
            render: (v: string) => <Tag color={v === 'COMPLETED' ? 'green' : v === 'FAILED' ? 'red' : 'blue'}>{v}</Tag>,
        },
        { title: 'Metric', dataIndex: 'metric', key: 'metric' },
        { title: 'Time', dataIndex: 'time', key: 'time' },
        { title: 'Date', dataIndex: 'date', key: 'date' },
        {
            title: '', dataIndex: 'action', key: 'action',
            render: (_: any, record: any) => record.canView ? <a>View</a> : null,
        },
    ];

    const experimentData = experiments.map((exp, i) => {
        const metric = exp.results?.test_metrics?.accuracy != null
            ? `Acc: ${(exp.results.test_metrics.accuracy * 100).toFixed(1)}%`
            : exp.results?.test_metrics?.mse != null
                ? `MSE: ${exp.results.test_metrics.mse.toFixed(4)}`
                : '\u2014';
        return {
            key: exp.task_id,
            index: i + 1,
            model: exp.best_config?.model_name?.toUpperCase() || '\u2014',
            status: exp.status,
            metric,
            time: exp.results?.training_time_seconds ? formatTime(exp.results.training_time_seconds) : '\u2014',
            date: exp.started_at ? new Date(exp.started_at).toLocaleString() : '\u2014',
            canView: exp.status === 'COMPLETED',
            taskId: exp.task_id,
        };
    });

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>
            <div className="page-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
            }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>
                        <RocketOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
                        Model Training
                    </Title>
                    <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                        Configure and run GNN model training with automated hyperparameter optimization.
                    </Text>
                </div>
                {experiments.length > 0 && (
                    <Tag icon={<HistoryOutlined />} color="blue" style={{ fontSize: 13, padding: '4px 12px' }}>
                        {experiments.length} Experiment{experiments.length !== 1 ? 's' : ''}
                    </Tag>
                )}
            </div>

            <Row gutter={24}>
                {/* Left: Configuration */}
                <Col xs={24} md={12}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Card title="Model Selection" size="small">
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Switch checked={autoMode} onChange={setAutoMode} />
                                    <Text type="secondary">Auto (search all models)</Text>
                                </div>

                                {!autoMode && (
                                    <Checkbox.Group
                                        value={selectedModels}
                                        onChange={(vals) => setSelectedModels(vals as string[])}
                                        style={{ marginTop: 12 }}
                                    >
                                        <Space wrap>
                                            {ALL_MODELS.map(m => (
                                                <Tooltip
                                                    key={m}
                                                    title={hasEdgeAttrs && m === 'mlp' ? 'MLP does not use edge attributes' : ''}
                                                >
                                                    <Checkbox value={m}>{m.toUpperCase()}</Checkbox>
                                                </Tooltip>
                                            ))}
                                        </Space>
                                    </Checkbox.Group>
                                )}

                                {showEdgeAttrWarning && (
                                    <Alert
                                        type="warning"
                                        showIcon
                                        icon={<WarningOutlined />}
                                        message="MLP baseline does not use edge attributes. Consider using GCN, GAT, or GraphSAGE for better results with edge features."
                                    />
                                )}
                            </Space>
                        </Card>

                        <Card title="Optuna Trials" size="small">
                            <Slider
                                value={nTrials}
                                onChange={(val) => setNTrials(val)}
                                min={10}
                                max={300}
                                step={10}
                                disabled={isRunning}
                                tooltip={{ open: true }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>10</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>300</Text>
                            </div>
                        </Card>

                        <Card size="small">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space>
                                    <ClockCircleOutlined />
                                    <Text type="secondary">Estimated Time:</Text>
                                    {estimateLoading ? (
                                        <Spin size="small" />
                                    ) : estimate ? (
                                        <Text strong>~{formatTime(estimate.estimated_seconds)}</Text>
                                    ) : null}
                                </Space>
                                <Tag icon={<AppstoreOutlined />} color={estimate?.device === 'cuda' ? 'green' : 'default'}>
                                    {estimate?.device?.toUpperCase() || 'CPU'}
                                </Tag>
                            </div>
                        </Card>

                        {!isRunning && (
                            <Button
                                type="primary"
                                size="large"
                                block
                                icon={<PlayCircleOutlined />}
                                onClick={handleStart}
                                disabled={!autoMode && selectedModels.length === 0}
                            >
                                {experiments.length > 0 ? 'Start New Training' : 'Start Training'}
                            </Button>
                        )}

                        {isCompleted && (
                            <>
                                <Button
                                    type="primary"
                                    size="large"
                                    block
                                    icon={<CheckCircleOutlined />}
                                    onClick={() => router.push(`/projects/${projectId}/evaluate`)}
                                    style={{ background: token.colorSuccess, borderColor: token.colorSuccess }}
                                >
                                    View Latest Results
                                </Button>
                                <Button
                                    size="large"
                                    block
                                    icon={<RocketOutlined />}
                                    onClick={() => router.push(`/projects/${projectId}/models`)}
                                >
                                    Model Registry
                                </Button>
                            </>
                        )}

                        {error && <Alert type="error" showIcon message={error} />}
                    </Space>
                </Col>

                {/* Right: Progress & Logs */}
                <Col xs={24} md={12}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {taskStatus && (
                            <Card title="Training Progress" size="small" className="stat-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Tag color={isCompleted ? 'green' : isFailed ? 'red' : 'processing'}>
                                        {taskStatus.status}
                                    </Tag>
                                    <Text strong style={{ fontSize: 18, color: token.colorPrimary }}>
                                        {taskStatus.progress}%
                                    </Text>
                                </div>
                                <Progress
                                    percent={taskStatus.progress}
                                    showInfo={false}
                                    status={isCompleted ? 'success' : isFailed ? 'exception' : 'active'}
                                    strokeColor={
                                        isCompleted
                                            ? { from: '#10b981', to: '#34d399' }
                                            : isFailed
                                                ? token.colorError
                                                : { from: '#0891b2', to: '#06b6d4' }
                                    }
                                    strokeWidth={8}
                                />

                                <Row gutter={24} style={{ marginTop: 16 }}>
                                    <Col>
                                        <Text type="secondary" style={{ fontSize: 12 }}>Elapsed</Text>
                                        <div><Text strong>{formatTime(elapsed)}</Text></div>
                                    </Col>
                                    {estimatedRemaining >= 0 && (
                                        <Col>
                                            <Text type="secondary" style={{ fontSize: 12 }}>Remaining (est.)</Text>
                                            <div><Text strong>~{formatTime(estimatedRemaining)}</Text></div>
                                        </Col>
                                    )}
                                </Row>

                                {taskStatus.current_trial !== undefined && taskStatus.total_trials && (
                                    <Space style={{ marginTop: 12 }}>
                                        <Tag color="blue">Trial {taskStatus.current_trial} / {taskStatus.total_trials}</Tag>
                                        {taskStatus.device && (
                                            <Tag color={taskStatus.device === 'cuda' ? 'green' : 'default'}>
                                                {taskStatus.device.toUpperCase()}
                                            </Tag>
                                        )}
                                    </Space>
                                )}
                            </Card>
                        )}

                        {/* Terminal Log */}
                        <Card
                            title={
                                <Space>
                                    <div className={isRunning ? 'pulse-dot' : ''} style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        background: isRunning ? '#7fd962' : token.colorBorder,
                                        boxShadow: isRunning ? '0 0 8px rgba(127, 217, 98, 0.4)' : 'none',
                                    }} />
                                    <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1, fontWeight: 600 }}>TRAINING LOG</Text>
                                </Space>
                            }
                            size="small"
                            styles={{ body: { padding: 0 } }}
                        >
                            {/* Terminal header bar */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 16px',
                                background: '#1a1e26',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
                                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
                                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
                                <Text style={{ marginLeft: 8, fontSize: 11, color: '#636a76' }}>training@layoutxpert ~ </Text>
                            </div>
                            <div
                                ref={logRef}
                                className="terminal-log"
                                style={{
                                    padding: 16,
                                    maxHeight: 400,
                                    minHeight: 200,
                                    overflowY: 'auto',
                                }}
                            >
                                {logs.length === 0 ? (
                                    <span className="log-dim">$ waiting for training to start...</span>
                                ) : (
                                    logs.map((line, i) => (
                                        <div key={i} className={
                                            line.includes('FAILED') ? 'log-error' :
                                            line.includes('completed') ? 'log-success' :
                                            line.includes('Progress') ? 'log-info' : ''
                                        }>
                                            <span className="log-dim">$ </span>{line}
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </Space>
                </Col>
            </Row>

            {/* Experiment History */}
            {experiments.length > 0 && (
                <Card
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <HistoryOutlined style={{ color: token.colorPrimary }} />
                            <span>Experiment History</span>
                            <Tag color="blue" style={{ marginLeft: 4 }}>{experiments.length}</Tag>
                        </div>
                    }
                    className="stat-card"
                    style={{
                        marginTop: 24,
                    }}
                >
                    <Table
                        columns={experimentColumns}
                        dataSource={experimentData}
                        pagination={experiments.length > 10 ? { pageSize: 10 } : false}
                        size="small"
                        onRow={(record) => ({
                            onClick: () => {
                                if (record.canView) {
                                    router.push(`/projects/${projectId}/evaluate?task_id=${record.taskId}`);
                                }
                            },
                            style: { cursor: record.canView ? 'pointer' : 'default' },
                        })}
                    />
                </Card>
            )}
        </div>
    );
}
