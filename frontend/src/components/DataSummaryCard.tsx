'use client';

import { Card, Tag, Row, Col, Statistic, Typography } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface DataSummary {
    dataset_id: string;
    num_nodes: number;
    num_edges: number;
    num_features: number;
    num_classes: number | string;
    is_directed: boolean;
}

interface DataSummaryCardProps {
    summary: DataSummary;
}

export default function DataSummaryCard({ summary }: DataSummaryCardProps) {
    return (
        <Card style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <LineChartOutlined style={{ fontSize: 24 }} />
                <Title level={4} style={{ margin: 0 }}>Dataset Exploration Results</Title>
            </div>

            <Tag style={{ marginBottom: 24 }}>ID: {summary.dataset_id}</Tag>

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                    <Card size="small"><Statistic title="Total Nodes" value={summary.num_nodes} /></Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card size="small"><Statistic title="Total Edges" value={summary.num_edges} /></Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card size="small"><Statistic title="Node Features" value={summary.num_features} /></Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card size="small"><Statistic title="Classes" value={summary.num_classes} /></Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card size="small"><Statistic title="Structure" value={summary.is_directed ? 'Directed' : 'Undirected'} /></Card>
                </Col>
            </Row>
        </Card>
    );
}
