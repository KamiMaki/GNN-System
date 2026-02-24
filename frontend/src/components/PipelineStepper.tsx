'use client';

import React from 'react';
import { Steps, Tag, Avatar, Button, Breadcrumb, Divider, Dropdown } from 'antd';
import {
    AppstoreOutlined, UserOutlined, SettingOutlined, LogoutOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const STEPS = [
    { label: 'Upload Data', description: 'Upload graph CSV files' },
    { label: 'Data Analysis', description: 'Explore & configure' },
    { label: 'Training', description: 'Model training & HPO' },
    { label: 'Evaluation', description: 'Results & metrics' },
];

interface PipelineStepperProps {
    currentStep: number;
    projectName: string;
    projectId: string;
    status?: string;
}

const STATUS_TAG_COLOR: Record<string, string> = {
    completed: 'green',
    failed: 'red',
    training: 'processing',
};

export default function PipelineStepper({ currentStep, projectName, projectId, status }: PipelineStepperProps) {
    const router = useRouter();
    const { user, logout } = useAuth();
    const activeIndex = currentStep - 1;

    const stepPaths = [
        `/projects/${projectId}/upload`,
        `/projects/${projectId}/explore`,
        `/projects/${projectId}/train`,
        `/projects/${projectId}/evaluate`,
    ];

    const handleStepClick = (index: number) => {
        router.push(stepPaths[index]);
    };

    const userMenuItems = user ? {
        items: [
            { key: 'header', label: <div><div style={{ fontWeight: 700 }}>{user.name}</div><div style={{ fontSize: 12, opacity: 0.6 }}>{user.email}</div></div>, disabled: true },
            { type: 'divider' as const },
            { key: 'profile', label: 'Profile', icon: <UserOutlined /> },
            { key: 'settings', label: 'Settings', icon: <SettingOutlined /> },
            { type: 'divider' as const },
            { key: 'logout', label: 'Logout', icon: <LogoutOutlined />, danger: true },
        ],
        onClick: ({ key }: { key: string }) => {
            if (key === 'logout') logout();
        },
    } : { items: [] };

    return (
        <div style={{
            padding: '12px 24px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
        }}>
            <Button
                type="text"
                icon={<AppstoreOutlined />}
                onClick={() => router.push('/dashboard')}
                style={{ fontWeight: 800, fontSize: '1rem' }}
            >
                LayoutXpert
            </Button>

            <Divider type="vertical" style={{ height: 28 }} />

            <Breadcrumb
                items={[
                    { title: <a onClick={(e) => { e.preventDefault(); router.push('/dashboard'); }}>Dashboard</a> },
                    { title: <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{projectName}</span> },
                    { title: <strong>{STEPS[activeIndex]?.label}</strong> },
                ]}
            />

            {status && (
                <Tag color={STATUS_TAG_COLOR[status] || 'default'}>
                    {status.replace('_', ' ').toUpperCase()}
                </Tag>
            )}

            <Steps
                current={activeIndex}
                size="small"
                style={{ flex: 1 }}
                onChange={handleStepClick}
                items={STEPS.map((step) => ({
                    title: step.label,
                }))}
            />

            {user && (
                <Dropdown menu={userMenuItems} trigger={['click']} placement="bottomRight">
                    <Avatar
                        src={user.avatar}
                        alt={user.name}
                        size={32}
                        style={{ cursor: 'pointer' }}
                        icon={<UserOutlined />}
                    />
                </Dropdown>
            )}
        </div>
    );
}
