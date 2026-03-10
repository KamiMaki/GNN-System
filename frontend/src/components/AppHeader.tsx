'use client';

import React, { useState } from 'react';
import {
    Button, Avatar, Dropdown, Breadcrumb, Steps, Divider, Tag, Typography, theme, Grid, Drawer, Space,
} from 'antd';
import {
    AppstoreOutlined, UserOutlined, SettingOutlined, LogoutOutlined,
    SunOutlined, MoonOutlined, MenuOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ColorModeContext } from '@/contexts/ColorModeContext';

const { Text } = Typography;
const { useBreakpoint } = Grid;

const STEPS = [
    { label: 'Upload Data' },
    { label: 'Data Analysis' },
    { label: 'Training' },
    { label: 'Evaluation' },
];

const STEP_PATHS = (projectId: string) => [
    `/projects/${projectId}/upload`,
    `/projects/${projectId}/explore`,
    `/projects/${projectId}/train`,
    `/projects/${projectId}/evaluate`,
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

    const handleStepClick = (index: number) => {
        if (projectId) router.push(STEP_PATHS(projectId)[index]);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Button
                type="text"
                icon={<AppstoreOutlined />}
                onClick={() => router.push('/dashboard')}
                style={{ fontWeight: 800, fontSize: '1rem', padding: '4px 8px' }}
            >
                LayoutXpert
            </Button>
        </div>
    );

    const rightSection = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Button
                type="text"
                icon={mode === 'light' ? <MoonOutlined /> : <SunOutlined />}
                onClick={toggleColorMode}
                style={{ fontSize: 16 }}
                title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            />
            {user && (
                <>
                    <Divider type="vertical" style={{ height: 28, margin: '0 4px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                        <Text strong style={{ fontSize: 13 }}>{user.name}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{user.role}</Text>
                    </div>
                    <Dropdown menu={userMenuItems} trigger={['click']} placement="bottomRight">
                        <Avatar
                            src={user.avatar}
                            alt={user.name}
                            size={32}
                            style={{ cursor: 'pointer' }}
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
            <Text type="secondary">{subtitle}</Text>
        </div>
    ) : (
        <div style={{ flex: 1 }} />
    );

    if (isMobile) {
        return (
            <>
                <div style={{
                    padding: '12px 16px',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
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
                                items={STEPS.map(s => ({ title: s.label }))}
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
        <div style={{
            padding: '12px 24px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
        }}>
            {logoSection}
            <Divider type="vertical" style={{ height: 28 }} />
            {middleSection}
            {isProjectMode && (
                <Steps
                    current={activeIndex}
                    size="small"
                    style={{ flex: 2, maxWidth: 500 }}
                    onChange={handleStepClick}
                    items={STEPS.map(s => ({ title: s.label }))}
                />
            )}
            {rightSection}
        </div>
    );
}
