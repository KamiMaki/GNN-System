'use client';

import { Table, Typography } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface Results {
    accuracy: number;
    training_time_seconds: number;
}

interface ResultsTableProps {
    results: Results;
}

export default function ResultsTable({ results }: ResultsTableProps) {
    const columns = [
        { title: 'Metric', dataIndex: 'metric', key: 'metric' },
        { title: 'Value', dataIndex: 'value', key: 'value', align: 'right' as const },
    ];

    const dataSource = [
        { key: '1', metric: 'Model Accuracy', value: `${(results.accuracy * 100).toFixed(2)}%` },
        { key: '2', metric: 'Training Duration', value: `${results.training_time_seconds.toFixed(2)}s` },
    ];

    return (
        <div style={{ marginTop: 48, marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <DashboardOutlined />
                <Title level={5} style={{ margin: 0 }}>Evaluation Metrics</Title>
            </div>
            <Table columns={columns} dataSource={dataSource} pagination={false} size="small" />
        </div>
    );
}
