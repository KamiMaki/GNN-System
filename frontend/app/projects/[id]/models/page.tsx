'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Card, Button, Tag, Spin, Space, Table, Alert, Typography, theme,
    Modal, Upload, Statistic, Row, Col, Empty, Popconfirm, Input, message,
    Descriptions, Divider, Tooltip, Badge,
} from 'antd';
import {
    RocketOutlined, UploadOutlined, DeleteOutlined, EditOutlined,
    ExperimentOutlined, CheckCircleOutlined, DatabaseOutlined,
    InfoCircleOutlined, FileTextOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';

import {
    listProjectModels, deleteModel, evaluateModelWithData, updateModelInfo,
    evaluateModelWithDemo, listDemoDatasets,
    RegisteredModel, EvaluationResult, SplitMetrics, DemoDatasetInfo,
} from '@/lib/api';

const { Title, Text, Paragraph } = Typography;

function MetricValue({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
    if (value === null || value === undefined) return null;
    return (
        <Statistic
            title={label}
            value={typeof value === 'number' ? (value < 1 && value > 0 ? value.toFixed(4) : value.toFixed(2)) : value}
            suffix={suffix}
            valueStyle={{ fontSize: 18 }}
        />
    );
}

function MetricsDisplay({ metrics, taskType }: { metrics: SplitMetrics; taskType: string }) {
    const isClassification = taskType.includes('classification');
    return (
        <Row gutter={[16, 8]}>
            {isClassification ? (
                <>
                    <Col span={6}><MetricValue label="Accuracy" value={metrics.accuracy} /></Col>
                    <Col span={6}><MetricValue label="F1 Score" value={metrics.f1_score} /></Col>
                    <Col span={6}><MetricValue label="Precision" value={metrics.precision} /></Col>
                    <Col span={6}><MetricValue label="Recall" value={metrics.recall} /></Col>
                </>
            ) : (
                <>
                    <Col span={8}><MetricValue label="MSE" value={metrics.mse} /></Col>
                    <Col span={8}><MetricValue label="MAE" value={metrics.mae} /></Col>
                    <Col span={8}><MetricValue label="R2 Score" value={metrics.r2_score} /></Col>
                </>
            )}
        </Row>
    );
}

export default function ModelsPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const { token } = theme.useToken();

    const [models, setModels] = useState<RegisteredModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Evaluate modal state
    const [evalModalOpen, setEvalModalOpen] = useState(false);
    const [evalModelId, setEvalModelId] = useState<string | null>(null);
    const [evalNodesFile, setEvalNodesFile] = useState<UploadFile[]>([]);
    const [evalEdgesFile, setEvalEdgesFile] = useState<UploadFile[]>([]);
    const [evaluating, setEvaluating] = useState(false);
    const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
    const [evalError, setEvalError] = useState<string | null>(null);

    // Edit modal state
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editModel, setEditModel] = useState<RegisteredModel | null>(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');

    // Detail modal state
    const [detailModel, setDetailModel] = useState<RegisteredModel | null>(null);

    const fetchModels = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await listProjectModels(projectId);
            setModels(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { fetchModels(); }, [fetchModels]);

    const handleDelete = async (modelId: string) => {
        try {
            await deleteModel(projectId, modelId);
            message.success('Model deleted');
            fetchModels();
        } catch (err: any) {
            message.error(err.message);
        }
    };

    // Demo data for evaluation
    const [demoDatasets, setDemoDatasets] = useState<DemoDatasetInfo[]>([]);
    const [evalUseDemo, setEvalUseDemo] = useState(false);
    const [evalDemoId, setEvalDemoId] = useState<string>('basic');

    useEffect(() => {
        listDemoDatasets().then(setDemoDatasets).catch(console.error);
    }, []);

    const openEvalModal = (modelId: string) => {
        setEvalModelId(modelId);
        setEvalNodesFile([]);
        setEvalEdgesFile([]);
        setEvalResult(null);
        setEvalError(null);
        setEvalUseDemo(false);
        setEvalModalOpen(true);
    };

    const handleEvaluate = async () => {
        if (!evalModelId) return;
        setEvaluating(true);
        setEvalError(null);
        try {
            let result: EvaluationResult;
            if (evalUseDemo) {
                result = await evaluateModelWithDemo(projectId, evalModelId, evalDemoId);
            } else {
                if (evalNodesFile.length === 0 || evalEdgesFile.length === 0) return;
                const nodesFile = evalNodesFile[0].originFileObj as File;
                const edgesFile = evalEdgesFile[0].originFileObj as File;
                result = await evaluateModelWithData(projectId, evalModelId, nodesFile, edgesFile);
            }
            setEvalResult(result);
        } catch (err: any) {
            setEvalError(err.message);
        } finally {
            setEvaluating(false);
        }
    };

    const openEditModal = (model: RegisteredModel) => {
        setEditModel(model);
        setEditName(model.name);
        setEditDesc(model.description);
        setEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editModel) return;
        try {
            await updateModelInfo(projectId, editModel.model_id, { name: editName, description: editDesc });
            message.success('Model updated');
            setEditModalOpen(false);
            fetchModels();
        } catch (err: any) {
            message.error(err.message);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
                <Spin size="large" />
            </div>
        );
    }

    const evalModel = evalModelId ? models.find(m => m.model_id === evalModelId) : null;
    const isClassification = evalResult?.task_type?.includes('classification');

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
            {/* Header */}
            <div className="page-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>
                        <RocketOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
                        Model Registry
                    </Title>
                    <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                        Manage trained models, evaluate with new data, and compare performance.
                    </Text>
                </div>
                <Badge count={models.length} showZero color={token.colorPrimary}>
                    <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px' }}>Registered Models</Tag>
                </Badge>
            </div>

            {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

            {models.length === 0 ? (
                <Card>
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <Space direction="vertical" align="center">
                                <Text type="secondary">No models registered yet</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    Models are automatically registered after successful training.
                                </Text>
                                <Button
                                    type="primary"
                                    icon={<ExperimentOutlined />}
                                    onClick={() => router.push(`/projects/${projectId}/train`)}
                                    style={{ marginTop: 8 }}
                                >
                                    Go to Training
                                </Button>
                            </Space>
                        }
                    />
                </Card>
            ) : (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {models.map((model) => {
                        const isClassif = model.task_type.includes('classification');
                        const primaryMetric = isClassif
                            ? model.test_metrics.accuracy
                            : model.test_metrics.r2_score;
                        const primaryLabel = isClassif ? 'Accuracy' : 'R2';

                        return (
                            <Card
                                key={model.model_id}
                                hoverable
                                className="card-hover-lift"
                                style={{
                                    borderLeft: `4px solid ${token.colorPrimary}`,
                                }}
                                styles={{ body: { padding: '20px 24px' } }}
                            >
                                <Row gutter={24} align="middle">
                                    <Col flex="auto">
                                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                            <Space align="center" size={8}>
                                                <Text strong style={{ fontSize: 16 }}>{model.name}</Text>
                                                <Tag color="blue">{model.model_name.toUpperCase()}</Tag>
                                                <Tag>{model.task_type.replace('_', ' ')}</Tag>
                                            </Space>
                                            {model.description && (
                                                <Text type="secondary" style={{ fontSize: 13 }}>{model.description}</Text>
                                            )}
                                            <Space size={16} style={{ marginTop: 4 }}>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    <DatabaseOutlined style={{ marginRight: 4 }} />
                                                    {model.num_features} features, {model.num_classes} classes
                                                </Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    Label: {model.label_column}
                                                </Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    Registered: {new Date(model.registered_at).toLocaleDateString()}
                                                </Text>
                                            </Space>
                                        </Space>
                                    </Col>
                                    <Col>
                                        <Statistic
                                            title={primaryLabel}
                                            value={primaryMetric != null ? (primaryMetric < 1 ? (primaryMetric * 100).toFixed(1) : primaryMetric.toFixed(2)) : '—'}
                                            suffix={primaryMetric != null && primaryMetric < 1 ? '%' : ''}
                                            valueStyle={{ color: token.colorPrimary, fontSize: 24 }}
                                        />
                                    </Col>
                                    <Col>
                                        <Space direction="vertical" size={4}>
                                            <Button
                                                type="primary"
                                                icon={<UploadOutlined />}
                                                onClick={() => openEvalModal(model.model_id)}
                                            >
                                                Evaluate
                                            </Button>
                                            <Space size={4}>
                                                <Tooltip title="Details">
                                                    <Button
                                                        size="small"
                                                        icon={<InfoCircleOutlined />}
                                                        onClick={() => setDetailModel(model)}
                                                    />
                                                </Tooltip>
                                                <Tooltip title="Edit">
                                                    <Button
                                                        size="small"
                                                        icon={<EditOutlined />}
                                                        onClick={() => openEditModal(model)}
                                                    />
                                                </Tooltip>
                                                <Popconfirm
                                                    title="Delete this model?"
                                                    description="This will remove the model file permanently."
                                                    onConfirm={() => handleDelete(model.model_id)}
                                                    okText="Delete"
                                                    okType="danger"
                                                >
                                                    <Tooltip title="Delete">
                                                        <Button size="small" danger icon={<DeleteOutlined />} />
                                                    </Tooltip>
                                                </Popconfirm>
                                            </Space>
                                        </Space>
                                    </Col>
                                </Row>
                            </Card>
                        );
                    })}
                </Space>
            )}

            {/* Evaluate Modal */}
            <Modal
                title={
                    <Space>
                        <ExperimentOutlined style={{ color: token.colorPrimary }} />
                        <span>Evaluate Model with New Data</span>
                    </Space>
                }
                open={evalModalOpen}
                onCancel={() => { setEvalModalOpen(false); setEvalResult(null); }}
                footer={evalResult ? [
                    <Button key="close" onClick={() => { setEvalModalOpen(false); setEvalResult(null); }}>
                        Close
                    </Button>,
                ] : [
                    <Button key="cancel" onClick={() => setEvalModalOpen(false)}>
                        Cancel
                    </Button>,
                    <Button
                        key="eval"
                        type="primary"
                        icon={<ExperimentOutlined />}
                        loading={evaluating}
                        disabled={!evalUseDemo && (evalNodesFile.length === 0 || evalEdgesFile.length === 0)}
                        onClick={handleEvaluate}
                    >
                        Run Evaluation
                    </Button>,
                ]}
                width={700}
                destroyOnClose
            >
                {evalModel && (
                    <div style={{ marginBottom: 16 }}>
                        <Space>
                            <Tag color="blue">{evalModel.model_name.toUpperCase()}</Tag>
                            <Text strong>{evalModel.name}</Text>
                            <Text type="secondary">| Label: {evalModel.label_column}</Text>
                        </Space>
                    </div>
                )}

                {!evalResult ? (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {/* Data source toggle */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Button
                                type={!evalUseDemo ? 'primary' : 'default'}
                                onClick={() => setEvalUseDemo(false)}
                                icon={<UploadOutlined />}
                            >
                                Upload CSV
                            </Button>
                            <Button
                                type={evalUseDemo ? 'primary' : 'default'}
                                onClick={() => setEvalUseDemo(true)}
                                icon={<DatabaseOutlined />}
                            >
                                Use Demo Data
                            </Button>
                        </div>

                        {evalUseDemo ? (
                            <div>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>Select Demo Dataset</Text>
                                <select
                                    value={evalDemoId}
                                    onChange={e => setEvalDemoId(e.target.value)}
                                    style={{
                                        width: '100%', padding: '8px 12px', borderRadius: 8,
                                        border: `1px solid ${token.colorBorder}`,
                                        background: token.colorBgContainer, color: token.colorText,
                                        fontSize: 14,
                                    }}
                                >
                                    {demoDatasets.map(d => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.nodes} nodes)</option>
                                    ))}
                                </select>
                                <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                                    {demoDatasets.find(d => d.id === evalDemoId)?.description}
                                </Text>
                            </div>
                        ) : (
                            <>
                                <Alert
                                    type="info"
                                    showIcon
                                    icon={<FileTextOutlined />}
                                    message="Upload CSV files with the same schema as the training data"
                                    description={`The data must contain the label column "${evalModel?.label_column}" and the same feature columns used during training.`}
                                />
                                <div>
                                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Nodes CSV</Text>
                                    <Upload
                                        accept=".csv"
                                        maxCount={1}
                                        fileList={evalNodesFile}
                                        onChange={({ fileList }) => setEvalNodesFile(fileList)}
                                        beforeUpload={() => false}
                                    >
                                        <Button icon={<UploadOutlined />}>Select nodes file</Button>
                                    </Upload>
                                </div>
                                <div>
                                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Edges CSV</Text>
                                    <Upload
                                        accept=".csv"
                                        maxCount={1}
                                        fileList={evalEdgesFile}
                                        onChange={({ fileList }) => setEvalEdgesFile(fileList)}
                                        beforeUpload={() => false}
                                    >
                                        <Button icon={<UploadOutlined />}>Select edges file</Button>
                                    </Upload>
                                </div>
                            </>
                        )}
                        {evalError && <Alert type="error" showIcon message={evalError} />}
                    </Space>
                ) : (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Alert
                            type="success"
                            showIcon
                            icon={<CheckCircleOutlined />}
                            message={`Evaluation complete — ${evalResult.num_samples} samples evaluated`}
                        />

                        <Card size="small" title="Performance Metrics">
                            <MetricsDisplay metrics={evalResult.metrics} taskType={evalResult.task_type} />
                        </Card>

                        {/* Confusion Matrix */}
                        {isClassification && evalResult.confusion_matrix && (() => {
                            const { labels, matrix } = evalResult.confusion_matrix;
                            const n = labels.length;
                            const maxVal = Math.max(...matrix.flat(), 1);
                            return (
                                <Card size="small" title="Confusion Matrix">
                                    <div style={{ overflowX: 'auto' }}>
                                        <div style={{
                                            display: 'inline-flex',
                                            flexDirection: 'column',
                                            gap: 0,
                                            minWidth: Math.max(300, 80 + n * 70),
                                        }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${n}, minmax(60px, 1fr))`, gap: 4 }}>
                                                <div style={{ padding: 6, textAlign: 'center' }}>
                                                    <Text type="secondary" style={{ fontSize: 11 }}>A \ P</Text>
                                                </div>
                                                {labels.map(label => (
                                                    <div key={label} style={{ textAlign: 'center', padding: 6 }}>
                                                        <Text strong style={{ fontSize: 12 }}>{label}</Text>
                                                    </div>
                                                ))}
                                            </div>
                                            {matrix.map((row, i) => (
                                                <div key={i} style={{ display: 'grid', gridTemplateColumns: `80px repeat(${n}, minmax(60px, 1fr))`, gap: 4 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px' }}>
                                                        <Text strong style={{ fontSize: 12 }}>{labels[i]}</Text>
                                                    </div>
                                                    {row.map((val, j) => {
                                                        const isDiag = i === j;
                                                        const intensity = val / maxVal;
                                                        const bg = isDiag
                                                            ? `color-mix(in srgb, ${token.colorSuccess} ${Math.round(intensity * 60 + 15)}%, ${token.colorBgContainer})`
                                                            : val > 0
                                                                ? `color-mix(in srgb, ${token.colorError} ${Math.round(intensity * 60 + 15)}%, ${token.colorBgContainer})`
                                                                : token.colorBgContainer;
                                                        return (
                                                            <div key={j} style={{
                                                                textAlign: 'center',
                                                                padding: '10px 6px',
                                                                borderRadius: token.borderRadius,
                                                                background: bg,
                                                                border: isDiag
                                                                    ? `2px solid ${token.colorSuccess}40`
                                                                    : `1px solid ${token.colorBorderSecondary}`,
                                                            }}>
                                                                <div style={{ fontSize: 16, fontWeight: 700 }}>{val}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })()}

                        {/* Residual Plot */}
                        {!isClassification && evalResult.residual_data && evalResult.residual_data.length > 0 && (
                            <Card size="small" title="Residual Plot (Actual vs Predicted)">
                                <ResponsiveContainer width="100%" height={250}>
                                    <ScatterChart>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="actual" name="Actual" tick={{ fontSize: 11 }} />
                                        <YAxis dataKey="predicted" name="Predicted" tick={{ fontSize: 11 }} />
                                        <RechartsTooltip />
                                        <Scatter data={evalResult.residual_data} fill={token.colorPrimary} opacity={0.6} />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </Card>
                        )}
                    </Space>
                )}
            </Modal>

            {/* Edit Modal */}
            <Modal
                title="Edit Model"
                open={editModalOpen}
                onCancel={() => setEditModalOpen(false)}
                onOk={handleSaveEdit}
                okText="Save"
            >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                        <Text strong style={{ display: 'block', marginBottom: 4 }}>Name</Text>
                        <Input value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div>
                        <Text strong style={{ display: 'block', marginBottom: 4 }}>Description</Text>
                        <Input.TextArea
                            value={editDesc}
                            onChange={e => setEditDesc(e.target.value)}
                            rows={3}
                            placeholder="Optional description..."
                        />
                    </div>
                </Space>
            </Modal>

            {/* Detail Modal */}
            <Modal
                title={
                    <Space>
                        <InfoCircleOutlined style={{ color: token.colorPrimary }} />
                        <span>Model Details</span>
                    </Space>
                }
                open={!!detailModel}
                onCancel={() => setDetailModel(null)}
                footer={[<Button key="close" onClick={() => setDetailModel(null)}>Close</Button>]}
                width={600}
            >
                {detailModel && (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Descriptions column={2} size="small" bordered>
                            <Descriptions.Item label="Model">{detailModel.model_name.toUpperCase()}</Descriptions.Item>
                            <Descriptions.Item label="Task Type">{detailModel.task_type}</Descriptions.Item>
                            <Descriptions.Item label="Label Column">{detailModel.label_column}</Descriptions.Item>
                            <Descriptions.Item label="Features">{detailModel.num_features}</Descriptions.Item>
                            <Descriptions.Item label="Classes">{detailModel.num_classes}</Descriptions.Item>
                            <Descriptions.Item label="Registered">{new Date(detailModel.registered_at).toLocaleString()}</Descriptions.Item>
                        </Descriptions>

                        <Card size="small" title="Best Configuration">
                            <Descriptions column={2} size="small">
                                <Descriptions.Item label="Hidden Dim">{detailModel.best_config.hidden_dim}</Descriptions.Item>
                                <Descriptions.Item label="Layers">{detailModel.best_config.num_layers}</Descriptions.Item>
                                <Descriptions.Item label="Dropout">{detailModel.best_config.dropout}</Descriptions.Item>
                                <Descriptions.Item label="Learning Rate">{detailModel.best_config.lr}</Descriptions.Item>
                            </Descriptions>
                        </Card>

                        <Card size="small" title="Training Metrics">
                            <MetricsDisplay metrics={detailModel.train_metrics} taskType={detailModel.task_type} />
                        </Card>

                        <Card size="small" title="Test Metrics">
                            <MetricsDisplay metrics={detailModel.test_metrics} taskType={detailModel.task_type} />
                        </Card>
                    </Space>
                )}
            </Modal>
        </div>
    );
}
