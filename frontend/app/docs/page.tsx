'use client';

import Link from 'next/link';
import { Card, Breadcrumb, Divider, Typography, Space } from 'antd';
import { ReadOutlined, ClusterOutlined, ToolOutlined, ExperimentOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>{icon}</span>
            <Title level={4} style={{ margin: 0 }}>{title}</Title>
        </div>
        <Divider style={{ margin: '0 0 16px' }} />
        {children}
    </Card>
);

export default function DocumentationPage() {
    return (
        <div style={{ minHeight: '100vh', padding: '24px 0 80px' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
                <Breadcrumb
                    style={{ marginBottom: 24 }}
                    items={[
                        { title: <Link href="/">Home</Link> },
                        { title: 'Documentation' },
                    ]}
                />

                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <Title level={2}>Documentation</Title>
                    <Paragraph type="secondary" style={{ maxWidth: 800, margin: '0 auto' }}>
                        Comprehensive guides on GraphX&apos;s GNN architecture, API endpoints, and integration workflows for physical design automation.
                    </Paragraph>
                </div>

                <Section title="Getting Started" icon={<ReadOutlined />}>
                    <Paragraph>
                        GraphX.AI bridges the gap between EDA physical design and geometric deep learning.
                        To begin, ensure you have your design data formatted in standard <strong>LEF/DEF</strong> or parsed graph formats (PyTorch Geometric compatible).
                    </Paragraph>

                    <Title level={5}>Prerequisites</Title>
                    <ul>
                        <li>Python 3.8+ environment</li>
                        <li>NVIDIA GPU (CUDA 11.3+) for inference acceleration</li>
                        <li>EDA Tools (Cadence Innovus / Synopsys ICC2) output logs for ground truth validation</li>
                    </ul>
                </Section>

                <Section title="GNN Model Architecture" icon={<ClusterOutlined />}>
                    <Paragraph>
                        Our platform utilizes a novel hetero-graph neural network designed specifically for Integrated Circuit (IC) netlists.
                        The architecture consists of three main stages:
                    </Paragraph>

                    <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
                        <Card size="small" style={{ borderLeft: '4px solid #1677ff' }}>
                            <Text strong>1. Feature Embedding</Text>
                            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                                Raw features (gate size, location x/y, fan-in/out) are projected into a 128-dim latent space using Multi-Layer Perceptrons (MLPs).
                            </Paragraph>
                        </Card>
                        <Card size="small" style={{ borderLeft: '4px solid #722ed1' }}>
                            <Text strong>2. Message Passing (MPNN)</Text>
                            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                                Information aggregates across cell-net-cell edges. We use GATv2 layers to attend to critical timing paths dynamically.
                            </Paragraph>
                        </Card>
                        <Card size="small" style={{ borderLeft: '4px solid #13c2c2' }}>
                            <Text strong>3. Readout & Prediction</Text>
                            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                                Global pooling aggregates graph-level stats for speed prediction (Regression), while node-level classifiers output violation probabilities (Binary Classification).
                            </Paragraph>
                        </Card>
                    </Space>
                </Section>

                <Section title="Technology Process Support" icon={<ExperimentOutlined />}>
                    <Paragraph>
                        The current version is calibrated for <strong>TSMC N2 (2nm)</strong> process nodes, accounting for FinFET/NanoSheet device characteristics.
                        Resistance and Capacitance (RC) extraction models are tuned to handle high wire resistance in advanced nodes.
                    </Paragraph>
                    <Text type="secondary" style={{ fontStyle: 'italic' }}>
                        *Backward compatibility with N5/N7 is available via the &apos;Legacy Mode&apos; flag.
                    </Text>
                </Section>

                <Section title="API Reference" icon={<ToolOutlined />}>
                    <Paragraph>
                        The platform exposes RESTful endpoints for automated pipeline integration.
                    </Paragraph>
                    <Card size="small" style={{ fontFamily: 'monospace', background: '#fafafa' }}>
                        <div style={{ color: '#1677ff' }}>POST /api/v1/jobs/submit</div>
                        <div style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 12 }}>Submit a new training or inference job.</div>

                        <div style={{ color: '#52c41a' }}>GET /api/v1/datasets/{'{id}'}/explore</div>
                        <div style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 12 }}>Retrieve graph statistics and topology metrics.</div>

                        <div style={{ color: '#faad14' }}>GET /api/v1/models/leaderboard</div>
                        <div style={{ color: '#8c8c8c', fontSize: 13 }}>Fetch comparative performance of trained architectures.</div>
                    </Card>
                    <div style={{ marginTop: 12 }}>
                        <Link href="/api-spec">View Full Swagger Specification &rarr;</Link>
                    </div>
                </Section>
            </div>
        </div>
    );
}
