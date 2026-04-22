'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sanitizeParam } from '@/lib/sanitize';
import {
    Card, Button, Tag, Spin, Space, Alert, Typography, theme,
    Modal, Statistic, Row, Col, Empty, Popconfirm, Input, message,
    Descriptions, Tooltip, Badge,
} from 'antd';
import {
    RocketOutlined, DeleteOutlined, EditOutlined,
    ExperimentOutlined, DatabaseOutlined, InfoCircleOutlined,
} from '@ant-design/icons';

import {
    listProjectModels, deleteModel, updateModelInfo,
    RegisteredModel, SplitMetrics,
} from '@/lib/api';

const { Title, Text } = Typography;


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
    const projectId = sanitizeParam(params.id);
    const { token } = theme.useToken();

    const [models, setModels] = useState<RegisteredModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editModel, setEditModel] = useState<RegisteredModel | null>(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');

    const [detailModel, setDetailModel] = useState<RegisteredModel | null>(null);

    const fetchModels = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const data = await listProjectModels(projectId);
            setModels(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
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
        } catch (err: unknown) {
            message.error(err instanceof Error ? err.message : String(err));
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
        } catch (err: unknown) {
            message.error(err instanceof Error ? err.message : String(err));
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>
                        <RocketOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
                        Model Registry
                    </Title>
                    <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                        Manage trained models. To evaluate on new data, upload a new Excel dataset to a project and retrain.
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
                        const primaryMetric = isClassif ? model.test_metrics.accuracy : model.test_metrics.r2_score;
                        const primaryLabel = isClassif ? 'Accuracy' : 'R2';
                        return (
                            <Card key={model.model_id} hoverable className="card-hover-lift"
                                style={{ borderLeft: `4px solid ${token.colorPrimary}` }}
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
                                            value={primaryMetric != null
                                                ? (primaryMetric < 1 ? (primaryMetric * 100).toFixed(1) : primaryMetric.toFixed(2))
                                                : '—'}
                                            suffix={primaryMetric != null && primaryMetric < 1 ? '%' : ''}
                                            valueStyle={{ color: token.colorPrimary, fontSize: 24 }}
                                        />
                                    </Col>
                                    <Col>
                                        <Space direction="vertical" size={4}>
                                            <Space size={4}>
                                                <Tooltip title="Details">
                                                    <Button size="small" icon={<InfoCircleOutlined />} onClick={() => setDetailModel(model)} />
                                                </Tooltip>
                                                <Tooltip title="Edit">
                                                    <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(model)} />
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

            {/* Edit modal */}
            <Modal
                title="Edit Model"
                open={editModalOpen}
                onCancel={() => setEditModalOpen(false)}
                onOk={handleSaveEdit}
                okText="Save"
            >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                        <Text strong>Name</Text>
                        <Input value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div>
                        <Text strong>Description</Text>
                        <Input.TextArea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
                    </div>
                </Space>
            </Modal>

            {/* Detail modal */}
            <Modal
                title={detailModel?.name || 'Model Details'}
                open={!!detailModel}
                onCancel={() => setDetailModel(null)}
                footer={[<Button key="close" onClick={() => setDetailModel(null)}>Close</Button>]}
                width={640}
            >
                {detailModel && (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Descriptions bordered size="small" column={2}>
                            <Descriptions.Item label="Model">{detailModel.model_name.toUpperCase()}</Descriptions.Item>
                            <Descriptions.Item label="Task">{detailModel.task_type}</Descriptions.Item>
                            <Descriptions.Item label="Label">{detailModel.label_column}</Descriptions.Item>
                            <Descriptions.Item label="Features">{detailModel.num_features}</Descriptions.Item>
                            <Descriptions.Item label="Hidden Dim">{detailModel.best_config.hidden_dim}</Descriptions.Item>
                            <Descriptions.Item label="Layers">{detailModel.best_config.num_layers}</Descriptions.Item>
                            <Descriptions.Item label="Dropout">{detailModel.best_config.dropout}</Descriptions.Item>
                            <Descriptions.Item label="LR">{detailModel.best_config.lr}</Descriptions.Item>
                        </Descriptions>
                        <div>
                            <Text strong>Training Metrics</Text>
                            <MetricsDisplay metrics={detailModel.train_metrics} taskType={detailModel.task_type} />
                        </div>
                        <div>
                            <Text strong>Test Metrics</Text>
                            <MetricsDisplay metrics={detailModel.test_metrics} taskType={detailModel.task_type} />
                        </div>
                    </Space>
                )}
            </Modal>
        </div>
    );
}
