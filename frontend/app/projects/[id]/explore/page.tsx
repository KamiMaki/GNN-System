'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sanitizeParam } from '@/lib/sanitize';
import {
    Button, Card, Tag, Select, Checkbox, Alert, Spin, Segmented, Space, Table, Typography, Row, Col, Statistic, theme,
    Modal, Badge, List,
} from 'antd';
import {
    CheckCircleOutlined, WarningOutlined, ArrowRightOutlined, ExperimentOutlined,
    ExpandAltOutlined, CloseCircleOutlined,
} from '@ant-design/icons';

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import {
    getProjectExplore, analyzeColumn, getCorrelation, validateLabel, imputeMissing, confirmData,
    getProject, getProjectGraphSample,
    GenericExploreData, ColumnStats, NumericColumnStats, CategoricalColumnStats,
    LabelValidationResult, GraphSampleData, ProjectDetail,
} from '@/lib/api';
import GraphPreview from '@/components/GraphPreview';

const { Title, Text } = Typography;

export default function ExplorePage() {
    const params = useParams();
    const router = useRouter();
    const projectId = sanitizeParam(params.id);
    const { token } = theme.useToken();

    const [projectMeta, setProjectMeta] = useState<ProjectDetail | null>(null);
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

    const taskType = projectMeta?.dataset_summary?.declared_task_type ?? '';
    const labelColumn = projectMeta?.dataset_summary?.declared_label_column ?? '';
    const [labelValidation, setLabelValidation] = useState<LabelValidationResult | null>(null);
    const [labelLoading, setLabelLoading] = useState(false);

    const [confirming, setConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);

    const [graphSample, setGraphSample] = useState<GraphSampleData | null>(null);
    const [graphSampleLoading, setGraphSampleLoading] = useState(false);
    const [selectedGraph, setSelectedGraph] = useState<string | undefined>(undefined);
    const [graphFullscreen, setGraphFullscreen] = useState(false);

    const fetchGraphSample = useCallback((graphName?: string) => {
        if (!projectId) return;
        setGraphSampleLoading(true);
        getProjectGraphSample(projectId, 500, graphName)
            .then(data => {
                setGraphSample(data);
                if (!graphName && data.graph_names && data.graph_names.length > 0) {
                    // Auto-select first graph for multi-graph datasets
                    setSelectedGraph(data.graph_names[0]);
                    setGraphSampleLoading(true);
                    getProjectGraphSample(projectId, 500, data.graph_names[0])
                        .then(setGraphSample)
                        .catch(console.error)
                        .finally(() => setGraphSampleLoading(false));
                }
            })
            .catch(console.error)
            .finally(() => setGraphSampleLoading(false));
    }, [projectId]);

    useEffect(() => {
        if (!projectId) return;
        setLoading(true);
        Promise.all([
            getProjectExplore(projectId),
            getProject(projectId),
        ])
            .then(([exploreResult, projectResult]) => {
                setExploreData(exploreResult);
                setCorrColumns(exploreResult.correlation_columns);
                setCorrData(exploreResult.feature_correlation);
                setProjectMeta(projectResult);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
        fetchGraphSample();
    }, [projectId, fetchGraphSample]);

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
        } catch (err: unknown) {
            setImputeResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
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
        } catch (err: unknown) {
            setConfirmError(err instanceof Error ? err.message : 'Confirmation failed');
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

    const canConfirm = Boolean(labelValidation?.valid) && !confirming;

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
        { title: 'Type', dataIndex: 'dtype', key: 'dtype', render: (v: string) => <Tag color={v === 'numeric' ? 'blue' : 'cyan'}>{v}</Tag> },
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
            <div className="page-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>
                        <ExperimentOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
                        Data Analysis
                    </Title>
                    <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                        Explore your data, handle missing values, and configure the learning task.
                    </Text>
                </div>
                <Space>
                    {exploreData.is_heterogeneous && (
                        <Tag color="purple" style={{ fontSize: 12, padding: '4px 10px' }}>
                            Heterogeneous
                        </Tag>
                    )}
                    <Tag icon={<CheckCircleOutlined />} color="blue" style={{ fontSize: 13, padding: '4px 12px' }}>
                        {exploreData.graph_count.toLocaleString()} graph{exploreData.graph_count > 1 ? 's' : ''}
                        {' · '}
                        {exploreData.num_nodes.toLocaleString()} nodes / {exploreData.num_edges.toLocaleString()} edges
                    </Tag>
                </Space>
            </div>

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* SECTION I: DATASET SUMMARY */}
                <Card title="I. Dataset Summary" data-testid="dataset-summary">
                    <Row gutter={16} style={{ marginBottom: exploreData.is_heterogeneous ? 16 : 24 }}>
                        <Col xs={12} sm={6}>
                            <Card size="small" style={{ textAlign: 'center' }}>
                                <Statistic title="GRAPHS" value={exploreData.graph_count} />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" style={{ textAlign: 'center' }}>
                                <Statistic
                                    title="AVG NODES / GRAPH"
                                    value={exploreData.avg_nodes_per_graph}
                                    precision={1}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" style={{ textAlign: 'center' }}>
                                <Statistic
                                    title="AVG EDGES / GRAPH"
                                    value={exploreData.avg_edges_per_graph}
                                    precision={1}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" style={{ textAlign: 'center' }}>
                                <Statistic
                                    title="TOTAL NODES / EDGES"
                                    value={`${exploreData.num_nodes} / ${exploreData.num_edges}`}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {exploreData.is_heterogeneous && (
                        <div data-testid="hetero-summary" style={{
                            borderTop: `1px solid ${token.colorBorderSecondary}`,
                            paddingTop: 16, marginBottom: 24,
                        }}>
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                <Space wrap>
                                    <Text strong>Node types ({exploreData.node_types.length}):</Text>
                                    {exploreData.node_types.map(t => (
                                        <Tag key={`n-${t}`} color="geekblue">{t}</Tag>
                                    ))}
                                </Space>
                                <Space wrap>
                                    <Text strong>Edge types ({exploreData.edge_types.length}):</Text>
                                    {exploreData.canonical_edges.length > 0 ? (
                                        exploreData.canonical_edges.map((ce, i) => (
                                            <Tag key={`e-${i}`} color="purple">
                                                {ce[0]} → {ce[1]} → {ce[2]}
                                            </Tag>
                                        ))
                                    ) : (
                                        exploreData.edge_types.map(t => (
                                            <Tag key={`e-${t}`} color="purple">{t}</Tag>
                                        ))
                                    )}
                                </Space>
                            </Space>
                        </div>
                    )}

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
                                                ? `color-mix(in srgb, ${token.colorPrimary} ${Math.round(intensity * 50)}%, transparent)`
                                                : `color-mix(in srgb, ${token.colorError} ${Math.round(intensity * 50)}%, transparent)`;
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

                {/* SECTION: INTERACTIVE GRAPH PREVIEW */}
                <Card
                    title="Interactive Graph Preview"
                    extra={
                        <Space>
                            {graphSample?.graph_names && graphSample.graph_names.length > 0 && (
                                <Select
                                    showSearch
                                    value={selectedGraph}
                                    onChange={(v) => {
                                        setSelectedGraph(v);
                                        setGraphSampleLoading(true);
                                        getProjectGraphSample(projectId, 500, v)
                                            .then(setGraphSample)
                                            .catch(console.error)
                                            .finally(() => setGraphSampleLoading(false));
                                    }}
                                    style={{ minWidth: 200 }}
                                    options={graphSample.graph_names.map(g => ({ value: g, label: g }))}
                                    filterOption={(input, opt) =>
                                        (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                />
                            )}
                            <Button
                                type="text"
                                icon={<ExpandAltOutlined />}
                                onClick={() => setGraphFullscreen(true)}
                                disabled={!graphSample || graphSample.nodes.length === 0}
                                title="Open fullscreen inspector"
                            >
                                Fullscreen
                            </Button>
                        </Space>
                    }
                >
                    {graphSampleLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                            <Spin />
                        </div>
                    ) : graphSample && graphSample.nodes.length > 0 ? (
                        <>
                            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                                {graphSample.num_nodes_total.toLocaleString()} nodes, {graphSample.num_edges_total.toLocaleString()} edges
                                {graphSample.current_graph && ` — ${graphSample.current_graph}`}
                            </Text>
                            <GraphPreview graphSample={graphSample} />
                        </>
                    ) : (
                        <Alert type="info" showIcon message="No graph data available for preview." />
                    )}
                </Card>

                {/* Fullscreen Graph Inspector — click ⛶ on the preview card to expand.
                    Uses the same GraphPreview component at a larger height. */}
                <Modal
                    open={graphFullscreen}
                    onCancel={() => setGraphFullscreen(false)}
                    footer={null}
                    width="95vw"
                    style={{ top: 16 }}
                    styles={{ body: { height: 'calc(100vh - 120px)', padding: 16 } }}
                    title={
                        <Space>
                            <ExpandAltOutlined />
                            <span>Graph Inspector</span>
                            {graphSample?.current_graph && <Tag>{graphSample.current_graph}</Tag>}
                            {graphSample && (
                                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                                    {graphSample.num_nodes_total.toLocaleString()} nodes · {graphSample.num_edges_total.toLocaleString()} edges
                                </Text>
                            )}
                        </Space>
                    }
                    destroyOnClose
                >
                    {graphSample && graphSample.nodes.length > 0 && (
                        <GraphPreview graphSample={graphSample} height={Math.max(480, typeof window !== 'undefined' ? window.innerHeight - 220 : 640)} />
                    )}
                </Modal>

                {/* SECTION: DATA QUALITY — graph-specific structural checks (v2) */}
                <DataQualityCard
                    exploreData={exploreData}
                    graphSample={graphSample}
                    taskType={taskType}
                    labelColumn={labelColumn}
                    labelValidation={labelValidation}
                />

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
                                            {info && <Tag color={info.dtype === 'numeric' ? 'blue' : 'cyan'}>{info.dtype}</Tag>}
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
                                                <Bar dataKey="count" fill={token.colorPrimary} radius={[4, 4, 0, 0]} />
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
                                <Tag color="cyan">Top: {(columnStats as CategoricalColumnStats).top_value} ({(columnStats as CategoricalColumnStats).top_count})</Tag>
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
                                            <Bar dataKey="count" fill="#0891b2" radius={[0, 4, 4, 0]} />
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
                <Card title={`III. Label & Target Analysis${labelColumn ? ` — ${labelColumn}` : ''}`}>
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
                                            <Bar dataKey="count" fill={token.colorInfo} radius={[4, 4, 0, 0]} />
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

// ════════════════════════════════════════════════════════════════
// Data Quality — graph-specific structural checks per v2 design.
// Derives ok/warn/err/na for each check from exploreData + graphSample
// (server-side explore response + a client-side sample of nodes/edges).
// Fields not yet exposed by the backend are rendered as "—" (na).
// ════════════════════════════════════════════════════════════════

type QualityStatus = 'ok' | 'warn' | 'err' | 'na';
interface QualityCheck {
    key: string;
    label: string;
    status: QualityStatus;
    detail: string;
}

function deriveQualityChecks(
    exploreData: GenericExploreData | null,
    graphSample: GraphSampleData | null,
    taskType: string,
    labelColumn: string,
    labelValidation: LabelValidationResult | null,
): QualityCheck[] {
    const checks: QualityCheck[] = [];

    // 1. Connected components (homogeneous: target = 1, heterogeneous: just report)
    if (graphSample && graphSample.nodes.length > 0) {
        const parent: Record<string, string> = {};
        const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
        graphSample.nodes.forEach(n => { parent[n.id] = n.id; });
        graphSample.edges.forEach(e => {
            if (parent[e.source] && parent[e.target]) {
                const a = find(e.source); const b = find(e.target);
                if (a !== b) parent[a] = b;
            }
        });
        const components = new Set(graphSample.nodes.map(n => find(n.id))).size;
        const status: QualityStatus = components === 1 ? 'ok' : components <= 3 ? 'warn' : 'err';
        checks.push({
            key: 'components', label: 'Connected components',
            status, detail: `${components} component(s) in sample`,
        });
    } else {
        checks.push({ key: 'components', label: 'Connected components', status: 'na', detail: '—' });
    }

    // 2. Isolated nodes
    if (graphSample && graphSample.nodes.length > 0) {
        const touched = new Set<string>();
        graphSample.edges.forEach(e => { touched.add(e.source); touched.add(e.target); });
        const isolated = graphSample.nodes.filter(n => !touched.has(n.id)).length;
        const status: QualityStatus = isolated === 0 ? 'ok' : isolated < 5 ? 'warn' : 'err';
        checks.push({ key: 'isolated', label: 'Isolated nodes', status, detail: `${isolated} in sample` });
    } else {
        checks.push({ key: 'isolated', label: 'Isolated nodes', status: 'na', detail: '—' });
    }

    // 3. Self-loops
    if (graphSample) {
        const selfLoops = graphSample.edges.filter(e => e.source === e.target).length;
        const status: QualityStatus = selfLoops === 0 ? 'ok' : 'warn';
        checks.push({ key: 'selfloops', label: 'Self-loops', status, detail: `${selfLoops} detected` });
    } else {
        checks.push({ key: 'selfloops', label: 'Self-loops', status: 'na', detail: '—' });
    }

    // 4. Duplicate edges (client-side over the sample — approximate)
    if (graphSample) {
        const seen = new Set<string>();
        let dupes = 0;
        graphSample.edges.forEach(e => {
            const k = `${e.source}→${e.target}|${e.edge_type ?? ''}`;
            if (seen.has(k)) dupes += 1; else seen.add(k);
        });
        const status: QualityStatus = dupes === 0 ? 'ok' : dupes < 10 ? 'warn' : 'err';
        checks.push({ key: 'duplicates', label: 'Duplicate edges', status, detail: `${dupes} in sample` });
    } else {
        checks.push({ key: 'duplicates', label: 'Duplicate edges', status: 'na', detail: '—' });
    }

    // 5. Heterogeneous vs homogeneous
    if (exploreData) {
        const hetero = exploreData.is_heterogeneous;
        checks.push({
            key: 'hetero', label: 'Graph schema',
            status: 'ok',
            detail: hetero
                ? `Heterogeneous · ${exploreData.node_types.length} node types · ${exploreData.edge_types.length} edge types`
                : 'Homogeneous',
        });
    }

    // 6. NaN / Inf in node features — use missing_count from columns.
    // For heterogeneous graphs the backend computes missing_count per node type,
    // so cross-type NaN padding (e.g. cell_area is NaN for pin/net rows) is NOT
    // counted here — those columns simply don't appear under unrelated types.
    if (exploreData) {
        const missingTotal = exploreData.columns.reduce((s, c) => s + (c.missing_count || 0), 0);
        const status: QualityStatus = missingTotal === 0 ? 'ok' : missingTotal < 50 ? 'warn' : 'err';
        const heteroNote = exploreData.is_heterogeneous ? ' (type-scoped NaN excluded)' : '';
        checks.push({
            key: 'nan', label: 'Feature NaN / missing',
            status, detail: `${missingTotal} missing cell(s) across ${exploreData.columns.length} cols${heteroNote}`,
        });
    }

    // 7. Label leakage — warn if labelColumn appears in a correlation pair with value ≈ 1
    if (labelColumn && exploreData) {
        const suspicious = exploreData.feature_correlation.find(c =>
            (c.x === labelColumn || c.y === labelColumn) && Math.abs(c.value) >= 0.98 && c.x !== c.y
        );
        checks.push({
            key: 'leakage', label: 'Label leakage',
            status: suspicious ? 'err' : 'ok',
            detail: suspicious
                ? `Feature "${suspicious.x === labelColumn ? suspicious.y : suspicious.x}" ≈ ${suspicious.value.toFixed(2)}`
                : 'No near-perfect feature↔label correlation',
        });
    } else {
        checks.push({ key: 'leakage', label: 'Label leakage', status: 'na', detail: 'Pick a label column' });
    }

    // 8. Degree distribution (from sample)
    if (graphSample && graphSample.nodes.length > 0) {
        const deg: Record<string, number> = {};
        graphSample.nodes.forEach(n => { deg[n.id] = 0; });
        graphSample.edges.forEach(e => {
            if (deg[e.source] !== undefined) deg[e.source] += 1;
            if (deg[e.target] !== undefined) deg[e.target] += 1;
        });
        const values = Object.values(deg);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((s, v) => s + v, 0) / values.length;
        const status: QualityStatus = max / (avg || 1) > 50 ? 'warn' : 'ok';
        checks.push({
            key: 'degree', label: 'Degree distribution',
            status, detail: `min ${min} · avg ${avg.toFixed(1)} · max ${max}`,
        });
    } else {
        checks.push({ key: 'degree', label: 'Degree distribution', status: 'na', detail: '—' });
    }

    // 9. Edge attribute coverage
    if (graphSample && graphSample.edges.length > 0) {
        const firstEdge = graphSample.edges[0];
        const attrKeys = Object.keys(firstEdge.attributes || {});
        if (attrKeys.length === 0) {
            checks.push({ key: 'edgeattr', label: 'Edge attributes', status: 'warn', detail: 'None present' });
        } else {
            const covered = graphSample.edges.filter(e =>
                attrKeys.every(k => e.attributes[k] != null)
            ).length;
            const pct = (covered / graphSample.edges.length) * 100;
            const status: QualityStatus = pct >= 99 ? 'ok' : pct >= 90 ? 'warn' : 'err';
            checks.push({ key: 'edgeattr', label: 'Edge attr coverage', status, detail: `${pct.toFixed(1)}% complete` });
        }
    } else {
        checks.push({ key: 'edgeattr', label: 'Edge attributes', status: 'na', detail: '—' });
    }

    // 10. Multi-graph count
    if (exploreData) {
        const count = exploreData.graph_count;
        checks.push({
            key: 'graphcount', label: 'Graph count',
            status: 'ok',
            detail: count === 1 ? 'Single graph' : `${count} graphs in dataset`,
        });
    }

    // 11. Class imbalance (classification) / Range (regression)
    if (taskType && labelValidation) {
        if (taskType.endsWith('classification') && labelValidation.class_distribution) {
            const counts = labelValidation.class_distribution.map(c => c.count);
            const imbalance = Math.max(...counts) / (Math.min(...counts) || 1);
            const status: QualityStatus = imbalance < 3 ? 'ok' : imbalance < 10 ? 'warn' : 'err';
            checks.push({
                key: 'imbalance', label: 'Class imbalance',
                status, detail: `max/min ratio = ${imbalance.toFixed(1)}`,
            });
        } else if (taskType.endsWith('regression') && labelValidation.value_range) {
            const r = labelValidation.value_range;
            checks.push({
                key: 'range', label: 'Target range',
                status: 'ok', detail: `μ=${r.mean.toFixed(2)} σ=${r.std.toFixed(2)} · [${r.min.toFixed(2)}, ${r.max.toFixed(2)}]`,
            });
        }
    } else {
        checks.push({ key: 'imbalance', label: 'Class balance / target range', status: 'na', detail: 'Pick task type' });
    }

    // 12. Train/val/test split presence — not exposed yet by backend
    checks.push({
        key: 'split', label: 'Train/val/test split',
        status: 'na',
        detail: 'Set automatically at training time',
    });

    return checks;
}

interface DataQualityCardProps {
    exploreData: GenericExploreData | null;
    graphSample: GraphSampleData | null;
    taskType: string;
    labelColumn: string;
    labelValidation: LabelValidationResult | null;
}

function DataQualityCard({ exploreData, graphSample, taskType, labelColumn, labelValidation }: DataQualityCardProps) {
    const { token } = theme.useToken();
    const checks = React.useMemo(
        () => deriveQualityChecks(exploreData, graphSample, taskType, labelColumn, labelValidation),
        [exploreData, graphSample, taskType, labelColumn, labelValidation]
    );

    const summary = checks.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
    }, {} as Record<QualityStatus, number>);

    const statusToColor: Record<QualityStatus, string> = {
        ok: token.colorSuccess,
        warn: token.colorWarning,
        err: token.colorError,
        na: token.colorTextDisabled,
    };

    const statusIcon = (s: QualityStatus) => {
        if (s === 'ok') return <CheckCircleOutlined style={{ color: statusToColor.ok }} />;
        if (s === 'warn') return <WarningOutlined style={{ color: statusToColor.warn }} />;
        if (s === 'err') return <CloseCircleOutlined style={{ color: statusToColor.err }} />;
        return <span style={{ color: statusToColor.na, fontSize: 14 }}>—</span>;
    };

    return (
        <Card
            title="Data Quality · Graph-level checks"
            extra={
                <Space size={6}>
                    <Badge count={summary.ok || 0} style={{ backgroundColor: statusToColor.ok }} />
                    <Badge count={summary.warn || 0} style={{ backgroundColor: statusToColor.warn }} />
                    <Badge count={summary.err || 0} style={{ backgroundColor: statusToColor.err }} />
                </Space>
            }
        >
            <List
                size="small"
                dataSource={checks}
                renderItem={(c) => (
                    <List.Item key={c.key}>
                        <Space size="middle" style={{ width: '100%' }}>
                            {statusIcon(c.status)}
                            <Typography.Text strong style={{ minWidth: 180 }}>{c.label}</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{c.detail}</Typography.Text>
                        </Space>
                    </List.Item>
                )}
            />
        </Card>
    );
}
