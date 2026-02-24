'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Button, Card, Tag, Select, Checkbox, Alert, Spin, Segmented, Space, Table, Typography, AutoComplete, Row, Col, Statistic,
} from 'antd';
import {
    CheckCircleOutlined, WarningOutlined, ArrowRightOutlined,
} from '@ant-design/icons';

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import {
    getProjectExplore, analyzeColumn, getCorrelation, validateLabel, imputeMissing, confirmData,
    GenericExploreData, ColumnInfo, ColumnStats, NumericColumnStats, CategoricalColumnStats,
    LabelValidationResult,
} from '@/lib/api';

const { Title, Text } = Typography;

const TASK_TYPES = [
    { value: 'node_classification', label: 'Node Classification' },
    { value: 'node_regression', label: 'Node Regression' },
    { value: 'graph_classification', label: 'Graph Classification' },
    { value: 'graph_regression', label: 'Graph Regression' },
];

export default function ExplorePage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [exploreData, setExploreData] = useState<GenericExploreData | null>(null);
    const [loading, setLoading] = useState(true);

    const [corrColumns, setCorrColumns] = useState<string[]>([]);
    const [corrData, setCorrData] = useState<Array<{ x: string; y: string; value: number }>>([]);

    const [selectedColumn, setSelectedColumn] = useState('');
    const [columnTypeOverride, setColumnTypeOverride] = useState<string | null>(null);
    const [columnStats, setColumnStats] = useState<ColumnStats | null>(null);
    const [columnLoading, setColumnLoading] = useState(false);

    const [imputeMethod, setImputeMethod] = useState<string>('mean');
    const [imputeLoading, setImputeLoading] = useState(false);
    const [imputeResult, setImputeResult] = useState<string | null>(null);

    const [taskType, setTaskType] = useState('');
    const [labelColumn, setLabelColumn] = useState('');
    const [labelValidation, setLabelValidation] = useState<LabelValidationResult | null>(null);
    const [labelLoading, setLabelLoading] = useState(false);

    const [confirming, setConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);

    useEffect(() => {
        if (!projectId) return;
        setLoading(true);
        getProjectExplore(projectId)
            .then(data => {
                setExploreData(data);
                setCorrColumns(data.correlation_columns);
                setCorrData(data.feature_correlation);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [projectId]);

    const handleCorrToggle = useCallback(async (col: string) => {
        const newCols = corrColumns.includes(col)
            ? corrColumns.filter(c => c !== col)
            : [...corrColumns, col];
        setCorrColumns(newCols);
        if (newCols.length >= 2) {
            try {
                const data = await getCorrelation(projectId, newCols);
                setCorrData(data);
            } catch (err) {
                console.error(err);
            }
        }
    }, [corrColumns, projectId]);

    useEffect(() => {
        if (!selectedColumn || !projectId) return;
        setColumnLoading(true);
        setColumnStats(null);
        setImputeResult(null);
        analyzeColumn(projectId, selectedColumn, columnTypeOverride || undefined)
            .then(setColumnStats)
            .catch(console.error)
            .finally(() => setColumnLoading(false));
    }, [selectedColumn, columnTypeOverride, projectId]);

    useEffect(() => {
        if (!taskType || !labelColumn || !projectId) {
            setLabelValidation(null);
            return;
        }
        setLabelLoading(true);
        validateLabel(projectId, taskType, labelColumn)
            .then(setLabelValidation)
            .catch(console.error)
            .finally(() => setLabelLoading(false));
    }, [taskType, labelColumn, projectId]);

    const handleImpute = async () => {
        if (!selectedColumn) return;
        setImputeLoading(true);
        try {
            const result = await imputeMissing(projectId, selectedColumn, imputeMethod);
            setImputeResult(`Filled ${result.filled_count} values using ${result.method}`);
            const data = await getProjectExplore(projectId);
            setExploreData(data);
            const stats = await analyzeColumn(projectId, selectedColumn, columnTypeOverride || undefined);
            setColumnStats(stats);
        } catch (err: any) {
            setImputeResult(`Error: ${err.message}`);
        } finally {
            setImputeLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!taskType || !labelColumn) return;
        setConfirming(true);
        setConfirmError(null);
        try {
            await confirmData(projectId, taskType, labelColumn);
            router.push(`/projects/${projectId}/train`);
        } catch (err: any) {
            setConfirmError(err.message || 'Confirmation failed');
        } finally {
            setConfirming(false);
        }
    };

    if (loading || !exploreData) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
                <Spin size="large" />
            </div>
        );
    }

    const numericColumns = exploreData.columns.filter(c => c.dtype === 'numeric');
    const allColumnNames = exploreData.columns.map(c => c.name);
    const missingColumns = exploreData.columns.filter(c => c.missing_count > 0);
    const currentColInfo = exploreData.columns.find(c => c.name === selectedColumn);

    const canConfirm = taskType && labelColumn && labelValidation?.valid && !confirming;

    // Build attribute summary table data
    const attrTableData = [
        ...exploreData.columns.map((col) => {
            const role = col.name === labelColumn ? 'label'
                : col.name.toLowerCase() === 'node_id' ? 'id'
                    : 'feature';
            return {
                key: `node-${col.name}`,
                name: col.name,
                dtype: col.dtype,
                role,
                source: 'node',
                missing: col.missing_count,
                missingPct: col.missing_pct,
                unique: col.unique_count,
            };
        }),
        ...(exploreData.edge_columns || []).map((col) => ({
            key: `edge-${col.name}`,
            name: col.name,
            dtype: col.dtype,
            role: 'edge_attr',
            source: 'edge',
            missing: col.missing_count,
            missingPct: col.missing_pct,
            unique: col.unique_count,
        })),
    ];

    const attrColumns = [
        { title: 'Column Name', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
        { title: 'Type', dataIndex: 'dtype', key: 'dtype', render: (v: string) => <Tag color={v === 'numeric' ? 'blue' : 'purple'}>{v}</Tag> },
        {
            title: 'Role', dataIndex: 'role', key: 'role',
            render: (v: string) => <Tag color={v === 'label' ? 'gold' : v === 'id' ? 'default' : v === 'edge_attr' ? 'cyan' : 'green'}>{v}</Tag>,
        },
        {
            title: 'Missing', dataIndex: 'missing', key: 'missing',
            render: (v: number) => <Text type={v > 0 ? 'danger' : 'secondary'}>{v}</Text>,
        },
        { title: 'Missing %', dataIndex: 'missingPct', key: 'missingPct', render: (v: number) => `${v.toFixed(1)}%` },
        { title: 'Unique', dataIndex: 'unique', key: 'unique' },
    ];

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Data Analysis</Title>
                    <Text type="secondary">Explore your data, handle missing values, and configure the learning task.</Text>
                </div>
                <Tag icon={<CheckCircleOutlined />} color="blue">
                    {exploreData.num_nodes.toLocaleString()} nodes / {exploreData.num_edges.toLocaleString()} edges
                </Tag>
            </div>

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* SECTION I: GRAPH TOPOLOGY */}
                <Card title="I. Graph Topology">
                    <Row gutter={16} style={{ marginBottom: 24 }}>
                        <Col xs={24} sm={12}>
                            <Card size="small" style={{ textAlign: 'center' }}>
                                <Statistic title="NODES" value={exploreData.num_nodes} />
                            </Card>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Card size="small" style={{ textAlign: 'center' }}>
                                <Statistic title="EDGES" value={exploreData.num_edges} />
                            </Card>
                        </Col>
                    </Row>

                    <Text strong>Feature Correlation</Text>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '8px 0 16px' }}>
                        {numericColumns.map(col => (
                            <Checkbox
                                key={col.name}
                                checked={corrColumns.includes(col.name)}
                                onChange={() => handleCorrToggle(col.name)}
                            >
                                <Text type="secondary" style={{ fontSize: 12 }}>{col.name}</Text>
                            </Checkbox>
                        ))}
                    </div>

                    {corrData.length > 0 && corrColumns.length >= 2 && (
                        <div style={{ overflowX: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${corrColumns.length}, 1fr)`, gap: 4 }}>
                                <div />
                                {corrColumns.map(col => (
                                    <div key={col} style={{ textAlign: 'center', padding: 4 }}>
                                        <Text type="secondary" style={{ fontSize: 11 }}>{col}</Text>
                                    </div>
                                ))}
                                {corrColumns.map(row => (
                                    <React.Fragment key={row}>
                                        <div style={{ padding: 4, display: 'flex', alignItems: 'center' }}>
                                            <Text type="secondary" style={{ fontSize: 11 }}>{row}</Text>
                                        </div>
                                        {corrColumns.map(col => {
                                            const cell = corrData.find(d => d.x === row && d.y === col);
                                            const val = cell?.value || 0;
                                            const intensity = Math.abs(val);
                                            const bgColor = val > 0
                                                ? `rgba(22, 119, 255, ${intensity * 0.5})`
                                                : `rgba(255, 77, 79, ${intensity * 0.5})`;
                                            return (
                                                <div key={`${row}-${col}`} style={{
                                                    background: bgColor,
                                                    borderRadius: 4,
                                                    padding: 4,
                                                    textAlign: 'center',
                                                    minHeight: 32,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    <Text style={{ fontSize: 12 }}>{val.toFixed(2)}</Text>
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                {/* SECTION II: NODE ANALYSIS */}
                <Card title="II. Node Analysis">
                    <Space size="middle" align="start" wrap>
                        <Select
                            placeholder="Select Column"
                            value={selectedColumn || undefined}
                            onChange={val => { setSelectedColumn(val); setColumnTypeOverride(null); }}
                            style={{ minWidth: 250 }}
                            options={allColumnNames.map(name => {
                                const info = exploreData.columns.find(c => c.name === name);
                                return {
                                    value: name,
                                    label: (
                                        <Space>
                                            {name}
                                            {info && <Tag color={info.dtype === 'numeric' ? 'blue' : 'purple'}>{info.dtype}</Tag>}
                                            {info && info.missing_count > 0 && <Tag color="red">{info.missing_count} missing</Tag>}
                                        </Space>
                                    ),
                                };
                            })}
                        />

                        {selectedColumn && currentColInfo && (
                            <Segmented
                                value={columnTypeOverride || currentColInfo.dtype}
                                onChange={(val) => setColumnTypeOverride(val as string)}
                                options={[
                                    { label: 'Numeric', value: 'numeric' },
                                    { label: 'Categorical', value: 'categorical' },
                                ]}
                            />
                        )}
                    </Space>

                    {columnLoading && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                            <Spin />
                        </div>
                    )}

                    {columnStats && columnStats.dtype === 'numeric' && (() => {
                        const isIdLike = currentColInfo && currentColInfo.unique_count === exploreData.num_nodes;
                        return (
                            <div style={{ marginTop: 24 }}>
                                {isIdLike ? (
                                    <Alert type="info" showIcon message={`Column "${selectedColumn}" appears to be an ID column (all ${currentColInfo?.unique_count} values are unique). Chart skipped.`} />
                                ) : (
                                    <>
                                        <Space wrap style={{ marginBottom: 16 }}>
                                            {[
                                                { label: 'Mean', value: (columnStats as NumericColumnStats).mean },
                                                { label: 'Median', value: (columnStats as NumericColumnStats).median },
                                                { label: 'Std', value: (columnStats as NumericColumnStats).std },
                                                { label: 'Min', value: (columnStats as NumericColumnStats).min },
                                                { label: 'Max', value: (columnStats as NumericColumnStats).max },
                                                { label: 'Q1', value: (columnStats as NumericColumnStats).q1 },
                                                { label: 'Q3', value: (columnStats as NumericColumnStats).q3 },
                                            ].map(s => (
                                                <Tag key={s.label}>{s.label}: {s.value.toFixed(4)}</Tag>
                                            ))}
                                            {(columnStats as NumericColumnStats).outlier_count > 0 && (
                                                <Tag color="red" icon={<WarningOutlined />}>
                                                    {(columnStats as NumericColumnStats).outlier_count} outliers
                                                </Tag>
                                            )}
                                        </Space>

                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={(columnStats as NumericColumnStats).distribution}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="range" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                                                <YAxis tick={{ fontSize: 11 }} />
                                                <Tooltip />
                                                <Bar dataKey="count" fill="#1677ff" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </>
                                )}
                            </div>
                        );
                    })()}

                    {columnStats && columnStats.dtype === 'categorical' && (() => {
                        const HIGH_CARDINALITY_THRESHOLD = 50;
                        const isHighCardinality = currentColInfo && currentColInfo.unique_count > HIGH_CARDINALITY_THRESHOLD;
                        return (
                            <div style={{ marginTop: 24 }}>
                                <Tag color="purple">Top: {(columnStats as CategoricalColumnStats).top_value} ({(columnStats as CategoricalColumnStats).top_count})</Tag>
                                {isHighCardinality ? (
                                    <Alert
                                        type="warning"
                                        showIcon
                                        style={{ marginTop: 8 }}
                                        message={`Column "${selectedColumn}" has ${currentColInfo?.unique_count} unique values. Chart rendering skipped for high-cardinality columns (>${HIGH_CARDINALITY_THRESHOLD} unique values).`}
                                    />
                                ) : (
                                    <ResponsiveContainer width="100%" height={Math.max(200, (columnStats as CategoricalColumnStats).value_counts.length * 35)}>
                                        <BarChart data={(columnStats as CategoricalColumnStats).value_counts} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" tick={{ fontSize: 11 }} />
                                            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="#722ed1" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        );
                    })()}

                    {/* Missing value imputation */}
                    {currentColInfo && currentColInfo.missing_count > 0 && (
                        <Alert
                            type="warning"
                            showIcon
                            style={{ marginTop: 16 }}
                            message={`Column "${selectedColumn}" has ${currentColInfo.missing_count} missing values (${currentColInfo.missing_pct}%).`}
                            action={
                                <Space>
                                    <Select
                                        value={imputeMethod}
                                        onChange={setImputeMethod}
                                        size="small"
                                        style={{ minWidth: 100 }}
                                        options={[
                                            { value: 'mean', label: 'Mean' },
                                            { value: 'median', label: 'Median' },
                                            { value: 'zero', label: 'Zero' },
                                        ]}
                                    />
                                    <Button size="small" onClick={handleImpute} loading={imputeLoading}>
                                        Fill
                                    </Button>
                                </Space>
                            }
                        />
                    )}
                    {imputeResult && (
                        <Alert type="success" showIcon message={imputeResult} style={{ marginTop: 8 }} />
                    )}
                </Card>

                {/* SECTION III: LABEL & TARGET ANALYSIS */}
                <Card title="III. Label & Target Analysis">
                    <Space size="middle" wrap>
                        <Select
                            placeholder="Task Type"
                            value={taskType || undefined}
                            onChange={setTaskType}
                            style={{ minWidth: 250 }}
                            options={TASK_TYPES}
                        />

                        <AutoComplete
                            placeholder="Label Column"
                            value={labelColumn || undefined}
                            onChange={setLabelColumn}
                            options={allColumnNames.map(n => ({ value: n }))}
                            style={{ minWidth: 250 }}
                            filterOption={(input, option) =>
                                (option?.value as string).toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    </Space>

                    {labelLoading && (
                        <div style={{ marginTop: 16 }}>
                            <Spin size="small" />
                        </div>
                    )}

                    {labelValidation && (
                        <div style={{ marginTop: 16 }}>
                            <Alert
                                type={labelValidation.valid ? 'success' : 'error'}
                                showIcon
                                message={labelValidation.message}
                            />

                            {labelValidation.valid && labelValidation.class_distribution && (
                                <div style={{ marginTop: 16 }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Class Distribution ({labelValidation.num_classes} classes)
                                    </Text>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={labelValidation.class_distribution}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <Tooltip />
                                            <Bar dataKey="count" fill="#13c2c2" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {labelValidation.valid && labelValidation.value_range && (
                                <Space wrap style={{ marginTop: 16 }}>
                                    {[
                                        { label: 'Min', value: labelValidation.value_range.min },
                                        { label: 'Max', value: labelValidation.value_range.max },
                                        { label: 'Mean', value: labelValidation.value_range.mean },
                                        { label: 'Std', value: labelValidation.value_range.std },
                                    ].map(s => (
                                        <Tag key={s.label} color="cyan">{s.label}: {s.value.toFixed(4)}</Tag>
                                    ))}
                                    <Tag color="blue">
                                        {labelValidation.is_continuous ? 'Continuous' : 'Discrete'}
                                    </Tag>
                                </Space>
                            )}
                        </div>
                    )}
                </Card>

                {/* Missing values summary */}
                {missingColumns.length > 0 && (
                    <Alert
                        type="info"
                        showIcon
                        message={`${missingColumns.length} column(s) have missing values: ${missingColumns.map(c => `${c.name} (${c.missing_count})`).join(', ')}. Select each column above to impute.`}
                    />
                )}

                {/* SECTION IV: ATTRIBUTE SUMMARY */}
                <Card title="IV. Attribute Summary">
                    <Table
                        columns={attrColumns}
                        dataSource={attrTableData}
                        pagination={false}
                        size="small"
                    />
                </Card>

                {/* Confirm & Proceed */}
                {confirmError && <Alert type="error" showIcon message={confirmError} />}

                {!taskType && (
                    <Alert type="info" showIcon message="Please select a task type and label column to proceed." />
                )}

                <Button
                    type="primary"
                    size="large"
                    block
                    icon={<ArrowRightOutlined />}
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    loading={confirming}
                >
                    Confirm & Proceed to Training
                </Button>
            </Space>
        </div>
    );
}
