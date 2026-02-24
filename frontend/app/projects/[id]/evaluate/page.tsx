'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, Tag, Spin, Table, Space, Alert, Statistic, Row, Col, Typography } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';

import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    BarChart, Bar,
    ScatterChart, Scatter,
} from 'recharts';

import { getProjectReport, getExperimentReport, Report, SplitMetrics } from '@/lib/api';

const { Title, Text } = Typography;

function MetricCard({ label, value, color }: { label: string; value: number | null; color?: string }) {
    if (value === null || value === undefined) return null;
    return (
        <Card size="small">
            <Statistic
                title={label}
                value={typeof value === 'number' ? (value < 1 ? value.toFixed(4) : value.toFixed(2)) : value}
                valueStyle={color ? { color } : undefined}
            />
        </Card>
    );
}

function MetricsRow({ label, metrics }: { label: string; metrics: SplitMetrics }) {
    const isClassification = metrics.accuracy !== null;
    return (
        <div>
            <Text strong style={{ display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2, fontSize: 12 }}>
                {label}
            </Text>
            <Row gutter={[12, 12]}>
                {isClassification ? (
                    <>
                        <Col xs={12} sm={6}><MetricCard label="Accuracy" value={metrics.accuracy} /></Col>
                        <Col xs={12} sm={6}><MetricCard label="F1 Score" value={metrics.f1_score} /></Col>
                        <Col xs={12} sm={6}><MetricCard label="Precision" value={metrics.precision} /></Col>
                        <Col xs={12} sm={6}><MetricCard label="Recall" value={metrics.recall} /></Col>
                    </>
                ) : (
                    <>
                        <Col xs={12} sm={8}><MetricCard label="MSE" value={metrics.mse} /></Col>
                        <Col xs={12} sm={8}><MetricCard label="MAE" value={metrics.mae} /></Col>
                        <Col xs={12} sm={8}><MetricCard label="R² Score" value={metrics.r2_score} /></Col>
                    </>
                )}
            </Row>
        </div>
    );
}

export default function EvaluatePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const projectId = params.id as string;
    const taskIdParam = searchParams.get('task_id');

    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!projectId) return;
        setLoading(true);
        const fetchReport = taskIdParam
            ? getExperimentReport(projectId, taskIdParam)
            : getProjectReport(projectId);
        fetchReport
            .then(setReport)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [projectId, taskIdParam]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (error || !report) {
        return (
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
                <Alert type="error" showIcon message={error || 'Report not available. Training may not be completed.'} />
            </div>
        );
    }

    const isClassification = report.task_type.includes('classification');

    const bestConfigColumns = [
        { title: 'Model', dataIndex: 'model', key: 'model' },
        { title: 'Hidden Dim', dataIndex: 'hidden_dim', key: 'hidden_dim' },
        { title: 'Num Layers', dataIndex: 'num_layers', key: 'num_layers' },
        { title: 'Dropout', dataIndex: 'dropout', key: 'dropout' },
        { title: 'Learning Rate', dataIndex: 'lr', key: 'lr' },
    ];

    const bestConfigData = report.best_config ? [{
        key: '1',
        model: report.best_config.model_name.toUpperCase(),
        hidden_dim: report.best_config.hidden_dim,
        num_layers: report.best_config.num_layers,
        dropout: report.best_config.dropout,
        lr: report.best_config.lr,
    }] : [];

    const leaderboardColumns = [
        {
            title: 'Rank', dataIndex: 'rank', key: 'rank',
            render: (_: any, __: any, i: number) => i === 0 ? '\ud83e\udd47' : i === 1 ? '\ud83e\udd48' : i === 2 ? '\ud83e\udd49' : `#${i + 1}`,
        },
        { title: 'Trial', dataIndex: 'trial', key: 'trial' },
        { title: 'Model', dataIndex: 'model', key: 'model', render: (v: string) => <Text strong>{v.toUpperCase()}</Text> },
        { title: 'Hidden Dim', dataIndex: 'hidden_dim', key: 'hidden_dim' },
        { title: 'Layers', dataIndex: 'num_layers', key: 'num_layers' },
        { title: 'Dropout', dataIndex: 'dropout', key: 'dropout' },
        { title: 'LR', dataIndex: 'lr', key: 'lr' },
        { title: 'Val Loss', dataIndex: 'val_loss', key: 'val_loss', render: (v: number) => v.toFixed(4) },
    ];

    const leaderboardData = (report.leaderboard || []).map((entry, i) => ({
        key: `${entry.trial}`,
        trial: entry.trial,
        model: entry.model,
        hidden_dim: entry.hidden_dim,
        num_layers: entry.num_layers,
        dropout: entry.dropout,
        lr: entry.lr,
        val_loss: entry.val_loss,
    }));

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Model Evaluation</Title>
                    <Text type="secondary">Task: {report.task_type.replace('_', ' ').toUpperCase()}</Text>
                </div>
                {report.best_config && (
                    <Tag icon={<TrophyOutlined />} color="gold">
                        Best: {report.best_config.model_name.toUpperCase()}
                    </Tag>
                )}
            </div>

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Performance Metrics */}
                <Card title="Performance Metrics">
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <MetricsRow label="Training" metrics={report.train_metrics} />
                        {report.val_metrics && (
                            <MetricsRow label="Validation" metrics={report.val_metrics} />
                        )}
                        <MetricsRow label="Test" metrics={report.test_metrics} />
                    </Space>
                </Card>

                {/* Confusion Matrix */}
                {isClassification && report.confusion_matrix && (
                    <Card title="Confusion Matrix">
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 8, maxWidth: 500, margin: '0 auto' }}>
                            <div />
                            <div style={{ textAlign: 'center', padding: 8 }}><Text type="secondary">Pred. Negative</Text></div>
                            <div style={{ textAlign: 'center', padding: 8 }}><Text type="secondary">Pred. Positive</Text></div>
                            {report.confusion_matrix.map((row, i) => (
                                <React.Fragment key={i}>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: 8 }}>
                                        <Text type="secondary">{row.actual}</Text>
                                    </div>
                                    <div style={{
                                        textAlign: 'center', padding: 16, borderRadius: 8,
                                        background: row.actual === 'Negative' ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)',
                                    }}>
                                        <Title level={4} style={{ margin: 0, color: row.actual === 'Negative' ? '#52c41a' : '#ff4d4f' }}>
                                            {row.predicted_negative}
                                        </Title>
                                    </div>
                                    <div style={{
                                        textAlign: 'center', padding: 16, borderRadius: 8,
                                        background: row.actual === 'Positive' ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)',
                                    }}>
                                        <Title level={4} style={{ margin: 0, color: row.actual === 'Positive' ? '#52c41a' : '#ff4d4f' }}>
                                            {row.predicted_positive}
                                        </Title>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Residual Plot */}
                {!isClassification && report.residual_data && report.residual_data.length > 0 && (
                    <Card title="Residual Plot (Actual vs Predicted)">
                        <ResponsiveContainer width="100%" height={350}>
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="actual" name="Actual" tick={{ fontSize: 11 }} label={{ value: 'Actual', position: 'bottom' }} />
                                <YAxis dataKey="predicted" name="Predicted" tick={{ fontSize: 11 }} label={{ value: 'Predicted', angle: -90, position: 'left' }} />
                                <Tooltip />
                                <Scatter data={report.residual_data} fill="#1677ff" opacity={0.6} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </Card>
                )}

                {/* Training History */}
                {report.history && report.history.length > 0 && (
                    <Card title="Training History">
                        <ResponsiveContainer width="100%" height={340}>
                            <LineChart data={report.history} margin={{ top: 5, right: 10, bottom: 25, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="epoch" tick={{ fontSize: 11 }} label={{ value: 'Epoch', position: 'insideBottom', offset: -15 }} />
                                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                                {isClassification && (
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 1]} />
                                )}
                                <Tooltip />
                                <Legend verticalAlign="top" />
                                <Line type="monotone" dataKey="loss" name="Train Loss" stroke="#1677ff" strokeWidth={2} dot={false} yAxisId="left" />
                                <Line type="monotone" dataKey="val_loss" name="Val Loss" stroke="#13c2c2" strokeWidth={2} dot={false} yAxisId="left" />
                                {isClassification && (
                                    <Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="#52c41a" strokeWidth={2} dot={false} yAxisId="right" />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                )}

                {/* Best Config */}
                {report.best_config && (
                    <Card title="Best Model Configuration">
                        <Table columns={bestConfigColumns} dataSource={bestConfigData} pagination={false} size="small" />
                    </Card>
                )}

                {/* Leaderboard */}
                {report.leaderboard && report.leaderboard.length > 0 && (
                    <Card title="Training Leaderboard">
                        <Table
                            columns={leaderboardColumns}
                            dataSource={leaderboardData}
                            pagination={false}
                            size="small"
                            scroll={{ y: 500 }}
                            rowClassName={(_, i) => i === 0 ? 'ant-table-row-selected' : ''}
                        />
                    </Card>
                )}
            </Space>
        </div>
    );
}
