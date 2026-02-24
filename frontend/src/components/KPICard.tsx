import React from 'react';
import { Card, Statistic } from 'antd';
import {
    ClockCircleOutlined, RiseOutlined, WarningOutlined, ThunderboltOutlined,
} from '@ant-design/icons';

const getIcon = (title: string) => {
    switch (title) {
        case 'Predicted Critical Delay (ns)':
            return <ClockCircleOutlined />;
        case 'Layout Score (0-100)':
            return <RiseOutlined />;
        case 'Hotspots Detected':
        case 'Potential Timing Violations':
            return <WarningOutlined />;
        default:
            return <ThunderboltOutlined />;
    }
};

export default function KPICard({ title, value, color }: { title: string; value: number; color: string }) {
    return (
        <Card>
            <Statistic
                title={title}
                value={typeof value === 'number' ? value.toFixed(2) : value}
                suffix={title.includes('(ns)') ? 'ns' : undefined}
                prefix={getIcon(title)}
                valueStyle={{ color }}
            />
        </Card>
    );
}
