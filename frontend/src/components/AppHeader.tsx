'use client';

import React, { useState } from 'react';
import {
    Button, Avatar, Dropdown, Breadcrumb, Steps, Divider, Tag, Typography, theme, Grid, Drawer, Space,
} from 'antd';
import {
    UserOutlined, SettingOutlined, LogoutOutlined,
    SunOutlined, MoonOutlined, MenuOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ColorModeContext } from '@/contexts/ColorModeContext';

const { Text } = Typography;
const { useBreakpoint } = Grid;

const STEPS = [
    { label: 'Upload' },
    { label: 'Analysis' },
    { label: 'Training' },
    { label: 'Evaluation' },
    { label: 'Models' },
];

const STEP_PATHS = (projectId: string) => [
    `/projects/${projectId}/upload`,
    `/projects/${projectId}/explore`,
    `/projects/${projectId}/train`,
    `/projects/${projectId}/evaluate`,
    `/projects/${projectId}/models`,
];

const STATUS_TAG_COLOR: Record<string, string> = {
    completed: 'green',
    failed: 'red',
    training: 'processing',
};

interface AppHeaderProps {
    subtitle?: string;
    projectName?: string;
    projectId?: string;
    projectStep?: number;
    projectStatus?: string;
}

export default function AppHeader({ subtitle, projectName, projectId, projectStep, projectStatus }: AppHeaderProps) {
    const router = useRouter();
    const { user, logout } = useAuth();
    const { mode, toggleColorMode } = React.useContext(ColorModeContext);
    const { token } = theme.useToken();
    const screens = useBreakpoint();
    const isMobile = !screens.md;
    const [drawerOpen, setDrawerOpen] = useState(false);

    const isProjectMode = !!(projectId && projectName);
    const activeIndex = isProjectMode ? (projectStep ?? 1) - 1 : -1;
    const baseMaxIndex = isProjectMode ? (projectStep ?? 1) - 1 : -1;
    const maxReachableIndex = (projectStatus === 'completed' && baseMaxIndex >= 3) ? 4 : baseMaxIndex;

    const handleStepClick = (index: number) => {
        if (!projectId) return;
        if (index > maxReachableIndex) return;
        router.push(STEP_PATHS(projectId)[index]);
    };

    const userMenuItems = user ? {
        items: [
            {
                key: 'header',
                label: (
                    <div>
                        <div style={{ fontWeight: 700 }}>{user.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>{user.email}</div>
                    </div>
                ),
                disabled: true,
            },
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

    const logoSection = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <img src="/graphx-icon.svg" alt="GraphX.AI" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <Button
                type="text"
                onClick={() => router.push('/dashboard')}
                style={{ fontWeight: 800, fontSize: '1rem', padding: '4px 4px' }}
            >
                <span className="gradient-text">GraphX.AI</span>
            </Button>
        </div>
    );

    const rightSection = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Button
                type="text"
                icon={mode === 'light' ? <MoonOutlined /> : <SunOutlined />}
                onClick={toggleColorMode}
                style={{
                    fontSize: 16,
                    borderRadius: 8,
                    width: 36,
                    height: 36,
                }}
                title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            />
            {user && (
                <>
                    <Divider type="vertical" style={{ height: 28, margin: '0 4px' }} />
                    <Text strong style={{ fontSize: 13 }}>{user.name}</Text>
                    <Dropdown menu={userMenuItems} trigger={['click']} placement="bottomRight">
                        <Avatar
                            src={user.avatar}
                            alt={user.name}
                            size={34}
                            style={{
                                cursor: 'pointer',
                                border: `2px solid ${token.colorPrimary}30`,
                                transition: 'border-color 0.2s',
                            }}
                            icon={<UserOutlined />}
                        />
                    </Dropdown>
                </>
            )}
        </div>
    );

    const middleSection = isProjectMode ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <Breadcrumb
                items={[
                    { title: <a onClick={(e) => { e.preventDefault(); router.push('/dashboard'); }}>Dashboard</a> },
                    {
                        title: (
                            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                {projectName}
                            </span>
                        ),
                    },
                    { title: <strong>{STEPS[activeIndex]?.label}</strong> },
                ]}
            />
            {projectStatus && (
                <Tag color={STATUS_TAG_COLOR[projectStatus] || 'default'}>
                    {projectStatus.replace('_', ' ').toUpperCase()}
                </Tag>
            )}
        </div>
    ) : subtitle ? (
        <div style={{ flex: 1 }}>
            <Text type="secondary" style={{ letterSpacing: 1, fontSize: 12, fontWeight: 500 }}>{subtitle}</Text>
        </div>
    ) : (
        <div style={{ flex: 1 }} />
    );

    if (isMobile) {
        return (
            <>
                <div className="glass-header" style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                }}>
                    {logoSection}
                    <div style={{ flex: 1 }} />
                    <Button
                        type="text"
                        icon={mode === 'light' ? <MoonOutlined /> : <SunOutlined />}
                        onClick={toggleColorMode}
                        style={{ fontSize: 16 }}
                    />
                    <Button
                        type="text"
                        icon={<MenuOutlined />}
                        onClick={() => setDrawerOpen(true)}
                    />
                </div>
                <Drawer
                    title="Menu"
                    placement="right"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    width={280}
                >
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {isProjectMode && (
                            <Steps
                                current={activeIndex}
                                direction="vertical"
                                size="small"
                                onChange={(i) => { handleStepClick(i); setDrawerOpen(false); }}
                                items={STEPS.map((s, i) => ({
                                    title: s.label,
                                    disabled: i > maxReachableIndex,
                                    status: (projectStatus === 'training' && i === 2) ? 'process' as const : undefined,
                                }))}
                            />
                        )}
                        {user && (
                            <div>
                                <div style={{ fontWeight: 700 }}>{user.name}</div>
                                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{user.email}</div>
                                <Button
                                    type="text"
                                    danger
                                    icon={<LogoutOutlined />}
                                    onClick={() => { logout(); setDrawerOpen(false); }}
                                    style={{ marginTop: 8, padding: 0 }}
                                >
                                    Logout
                                </Button>
                            </div>
                        )}
                    </Space>
                </Drawer>
            </>
        );
    }

    return (
        <div className="glass-header" style={{
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            position: 'sticky',
            top: 0,
            zIndex: 100,
        }}>
            {logoSection}
            <Divider type="vertical" style={{ height: 28 }} />
            {middleSection}
            {isProjectMode && (
                <Steps
                    current={activeIndex}
                    size="small"
                    style={{ flex: 2, maxWidth: 600 }}
                    onChange={handleStepClick}
                    items={STEPS.map((s, i) => ({
                        title: s.label,
                        disabled: i > maxReachableIndex,
                        status: (projectStatus === 'training' && i === 2) ? 'process' as const : undefined,
                    }))}
                />
            )}
            {rightSection}
        </div>
    );
}
