'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { sanitizeParam } from '@/lib/sanitize';
import { Button, Card, Input, Space, Alert, Tag, Divider, Row, Col, Typography, theme } from 'antd';
import {
    CloudUploadOutlined, FolderOpenOutlined, ExperimentOutlined,
    CheckCircleOutlined, FileTextOutlined, DownloadOutlined,
    FileExcelOutlined,
} from '@ant-design/icons';

import {
    uploadProjectFolder, loadDemoData, downloadSampleData,
    listDemoDatasets, DemoDatasetInfo,
    uploadProjectExcel, downloadSampleExcel,
} from '@/lib/api';

const { Title, Text } = Typography;

const TAG_COLORS: Record<string, string> = {
    'single-graph': 'cyan',
    'clean': 'green',
    'edge-features': 'gold',
    'multi-graph': 'geekblue',
    'missing-data': 'red',
    'outliers': 'orange',
};

interface GraphInfo {
    name: string;
    hasNodesTrain: boolean;
    hasEdgesTrain: boolean;
    hasNodesTest: boolean;
    hasEdgesTest: boolean;
    fileCount: number;
}

function analyzeFiles(files: File[]): { graphs: GraphInfo[]; isFlat: boolean } {
    const graphFiles: Record<string, Set<string>> = {};
    let isFlat = true;

    for (const file of files) {
        const path = file.webkitRelativePath || file.name;
        const parts = path.replace(/\\/g, '/').split('/');

        if (parts.length >= 3) {
            isFlat = false;
            const graphName = parts[parts.length - 2];
            const fname = parts[parts.length - 1].toLowerCase();
            if (!graphFiles[graphName]) graphFiles[graphName] = new Set();
            graphFiles[graphName].add(fname);
        } else {
            const fname = parts[parts.length - 1].toLowerCase();
            if (!graphFiles['_root']) graphFiles['_root'] = new Set();
            graphFiles['_root'].add(fname);
        }
    }

    const graphs: GraphInfo[] = Object.entries(graphFiles).map(([name, fnames]) => ({
        name: name === '_root' ? 'Root' : name,
        hasNodesTrain: fnames.has('nodes_train.csv') || fnames.has('node_train.csv'),
        hasEdgesTrain: fnames.has('edges_train.csv') || fnames.has('edge_train.csv'),
        hasNodesTest: fnames.has('nodes_test.csv') || fnames.has('node_test.csv'),
        hasEdgesTest: fnames.has('edges_test.csv') || fnames.has('edge_test.csv'),
        fileCount: fnames.size,
    }));

    return { graphs, isFlat };
}

export default function UploadPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = sanitizeParam(params.id);
    const { token } = theme.useToken();
    const folderInputRef = useRef<HTMLInputElement>(null);

    const [datasetName, setDatasetName] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [graphInfos, setGraphInfos] = useState<GraphInfo[]>([]);
    const [uploading, setUploading] = useState(false);
    const [excelUploading, setExcelUploading] = useState(false);
    const [loadingDemoId, setLoadingDemoId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [demos, setDemos] = useState<DemoDatasetInfo[]>([]);
    const excelInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        listDemoDatasets().then(setDemos).catch(console.error);
    }, []);

    const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f =>
            f.name.toLowerCase().endsWith('.csv')
        );
        if (files.length === 0) {
            setError('No CSV files found in selected folder.');
            return;
        }
        setError(null);
        setSelectedFiles(files);
        const { graphs } = analyzeFiles(files);
        setGraphInfos(graphs);
    };

    const validGraphs = graphInfos.filter(g => g.hasNodesTrain && g.hasEdgesTrain);
    const canUpload = validGraphs.length > 0;

    const handleUpload = async () => {
        if (!canUpload) return;
        setUploading(true);
        setError(null);
        try {
            await uploadProjectFolder(projectId, selectedFiles, datasetName);
            router.push(`/projects/${projectId}/explore`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError(null);
        setExcelUploading(true);
        try {
            await uploadProjectExcel(projectId, file, datasetName);
            // Task + label already declared in the Parameter sheet → skip confirm step.
            router.push(`/projects/${projectId}/explore`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Excel upload failed');
        } finally {
            setExcelUploading(false);
            if (excelInputRef.current) excelInputRef.current.value = '';
        }
    };

    const handleLoadDemo = async (demoId: string) => {
        setLoadingDemoId(demoId);
        setError(null);
        try {
            await loadDemoData(projectId, demoId);
            router.push(`/projects/${projectId}/explore`);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load demo data');
        } finally {
            setLoadingDemoId(null);
        }
    };

    const isLoading = uploading || excelUploading || loadingDemoId !== null;

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
            <div className="page-header">
                <Title level={3} style={{ margin: 0 }}>
                    <CloudUploadOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
                    Upload Data
                </Title>
                <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                    Select a project folder containing graph data, or load a demo dataset.
                </Text>
            </div>

            <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 24 }}>
                {/* Demo Datasets */}
                <Card title={<Space><ExperimentOutlined /> Demo Datasets <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>One-click load to explore the platform</Text></Space>}>
                    <Row gutter={[16, 16]}>
                        {demos.map((demo) => (
                            <Col xs={24} sm={12} key={demo.id}>
                                <Card size="small">
                                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                        <Text strong>{demo.name}</Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}>{demo.description}</Text>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {demo.tags.map(tag => (
                                                <Tag key={tag} color={TAG_COLORS[tag] || 'default'}>{tag}</Tag>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {demo.nodes} nodes &middot; {demo.edges} edges
                                            </Text>
                                            <Button
                                                size="small"
                                                type="primary"
                                                onClick={() => handleLoadDemo(demo.id)}
                                                disabled={isLoading}
                                                loading={loadingDemoId === demo.id}
                                                icon={<ExperimentOutlined />}
                                            >
                                                Load
                                            </Button>
                                        </div>
                                    </Space>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Card>

                <Divider>OR UPLOAD YOUR DATA</Divider>

                {/* Excel Template Upload (Preferred) */}
                <Card
                    data-testid="excel-upload-card"
                    title={
                        <Space>
                            <FileExcelOutlined style={{ color: token.colorSuccess }} />
                            Upload Excel Template
                            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                                Schema-driven — task type & label column auto-detected
                            </Text>
                        </Space>
                    }
                    extra={
                        <Button
                            href={downloadSampleExcel()}
                            download
                            icon={<DownloadOutlined />}
                            size="small"
                        >
                            Download Template
                        </Button>
                    }
                >
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            Fill in the <code>Parameter</code> sheet to declare features (X) and labels (Y),
                            then fill the <code>Node_*</code> / <code>Edge_*</code> / <code>Graph_*</code> sheets with data.
                            Phase 1 supports single-level Y (Node or Graph) and single Type per Level.
                        </Text>
                        <input
                            ref={excelInputRef}
                            type="file"
                            accept=".xlsx"
                            onChange={handleExcelSelect}
                            style={{ display: 'none' }}
                            data-testid="excel-file-input"
                        />
                        <Button
                            type="primary"
                            icon={<FileExcelOutlined />}
                            size="large"
                            loading={excelUploading}
                            disabled={isLoading}
                            onClick={() => excelInputRef.current?.click()}
                            block
                        >
                            {excelUploading ? 'Uploading Excel...' : 'Select .xlsx File'}
                        </Button>
                    </Space>
                </Card>

                <Divider plain>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Or use legacy CSV folder upload
                    </Text>
                </Divider>

                {/* Dataset Name */}
                <Input
                    placeholder="Dataset Name (optional) — Auto-detected from folder name"
                    value={datasetName}
                    onChange={e => setDatasetName(e.target.value)}
                />

                {/* Folder Upload */}
                <Card
                    onClick={() => folderInputRef.current?.click()}
                    hoverable
                    className={selectedFiles.length > 0 ? 'glow-success' : ''}
                    style={{
                        textAlign: 'center',
                        border: `2px dashed ${selectedFiles.length > 0 ? token.colorSuccess : token.colorBorder}`,
                        cursor: 'pointer',
                        background: selectedFiles.length > 0
                            ? `${token.colorSuccess}08`
                            : `${token.colorPrimary}04`,
                        transition: 'all 0.3s ease',
                    }}
                    styles={{ body: { padding: 48 } }}
                >
                    <input
                        ref={folderInputRef}
                        type="file"
                        // @ts-expect-error webkitdirectory is a non-standard attribute
                        webkitdirectory=""
                        directory=""
                        multiple
                        onChange={handleFolderSelect}
                        style={{ display: 'none' }}
                    />
                    {selectedFiles.length > 0 ? (
                        <Space direction="vertical">
                            <CheckCircleOutlined style={{ fontSize: 40, color: token.colorSuccess }} />
                            <Text strong>{selectedFiles.length} CSV files selected</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>Click to change folder</Text>
                        </Space>
                    ) : (
                        <Space direction="vertical">
                            <FolderOpenOutlined style={{ fontSize: 48, opacity: 0.3 }} />
                            <Text strong>Select Project Folder</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Choose a folder with graph subfolders, each containing{' '}
                                <code>nodes_train.csv</code> + <code>edges_train.csv</code>
                                {' '}(and optionally test files)
                            </Text>
                        </Space>
                    )}
                </Card>

                {/* Detected Graphs */}
                {graphInfos.length > 0 && (
                    <Card title={`Detected Graphs (${validGraphs.length}/${graphInfos.length})`} size="small">
                        <Space direction="vertical" style={{ width: '100%' }}>
                            {graphInfos.map((g) => {
                                const valid = g.hasNodesTrain && g.hasEdgesTrain;
                                return (
                                    <div key={g.name} style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '8px 12px', borderRadius: 8,
                                        background: valid ? `${token.colorSuccess}0f` : `${token.colorError}0f`,
                                    }}>
                                        {valid ? (
                                            <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                                        ) : (
                                            <CloudUploadOutlined style={{ color: token.colorError }} />
                                        )}
                                        <Text strong style={{ flex: 1 }}>{g.name}</Text>
                                        <Space size={4}>
                                            <Tag color={g.hasNodesTrain && g.hasEdgesTrain ? 'green' : 'red'}>train</Tag>
                                            {(g.hasNodesTest || g.hasEdgesTest) && (
                                                <Tag color={g.hasNodesTest && g.hasEdgesTest ? 'blue' : 'red'}>test</Tag>
                                            )}
                                        </Space>
                                    </div>
                                );
                            })}
                        </Space>
                        {validGraphs.length === 0 && (
                            <Alert
                                type="warning"
                                showIcon
                                message="No valid graphs detected. Each graph folder needs at least nodes_train.csv and edges_train.csv."
                                style={{ marginTop: 12 }}
                            />
                        )}
                    </Card>
                )}

                {/* Expected Format Info */}
                <Card size="small">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                        <FileTextOutlined />
                        <div style={{ flex: 1 }}>
                            <Text type="secondary">Expected folder structure:</Text>
                            <pre style={{ fontSize: 12, margin: '8px 0 0', lineHeight: 1.6 }}>
{`project_folder/
  graph_A/
    nodes_train.csv    (required)
    edges_train.csv    (required)
    nodes_test.csv     (optional)
    edges_test.csv     (optional)
  graph_B/
    ...`}
                            </pre>
                        </div>
                        <Button
                            href={downloadSampleData()}
                            download
                            icon={<DownloadOutlined />}
                            size="small"
                        >
                            Sample CSV
                        </Button>
                    </div>
                </Card>

                {error && <Alert type="error" showIcon message={error} />}

                {/* Upload Button */}
                <Button
                    type="primary"
                    size="large"
                    block
                    onClick={handleUpload}
                    disabled={!canUpload || isLoading}
                    loading={uploading}
                >
                    {uploading
                        ? 'Uploading...'
                        : `Upload ${validGraphs.length > 0 ? `${validGraphs.length} Graph${validGraphs.length > 1 ? 's' : ''}` : ''} & Continue`
                    }
                </Button>
            </Space>
        </div>
    );
}
