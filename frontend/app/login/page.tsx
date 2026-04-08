'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Typography, Space, theme } from 'antd';
import { SafetyOutlined, BankOutlined, KeyOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import Image from 'next/image';

const { Title, Text } = Typography;

export default function LoginPage() {
    const { login, isLoading } = useAuth();
    const { token } = theme.useToken();

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Aurora animated background */}
            <div className="aurora-bg" />

            {/* Subtle grid pattern overlay */}
            <div style={{
                position: 'fixed',
                inset: 0,
                backgroundImage: `radial-gradient(circle at 1px 1px, ${token.colorTextQuaternary} 1px, transparent 0)`,
                backgroundSize: '40px 40px',
                opacity: 0.3,
                zIndex: 0,
            }} />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: 'relative', zIndex: 1 }}
            >
                <Card
                    className="glass glow-primary"
                    style={{
                        width: 440,
                        textAlign: 'center',
                        borderRadius: 20,
                        border: `1px solid ${token.colorBorderSecondary}`,
                    }}
                    styles={{ body: { padding: '36px 32px' } }}
                >
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {/* Logo icon with gradient */}
                        <motion.div
                            initial={{ rotate: -10, scale: 0.8 }}
                            animate={{ rotate: 0, scale: 1 }}
                            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <Image src="/graphx-icon.svg" alt="GraphX.AI" width={72} height={72} style={{
                                borderRadius: 20,
                                margin: '0 auto',
                                boxShadow: '0 8px 32px rgba(8, 145, 178, 0.3)',
                            }} />
                        </motion.div>

                        <div>
                            <Title level={3} style={{ margin: 0, letterSpacing: '-0.5px' }}>
                                <span className="gradient-text">GraphX</span>
                                <span style={{ opacity: 0.5, fontWeight: 400 }}>.AI</span>
                            </Title>
                            <Space size={4} style={{ marginTop: 4 }}>
                                <BankOutlined style={{ opacity: 0.5 }} />
                                <Text type="secondary" style={{ fontSize: 13 }}>Graph Intelligence Platform</Text>
                            </Space>
                        </div>

                        <Text type="secondary" style={{ fontSize: 13 }}>
                            Enterprise Single Sign-On powered by Keycloak
                        </Text>

                        <Button
                            type="primary"
                            block
                            size="large"
                            loading={isLoading}
                            icon={<KeyOutlined />}
                            onClick={() => login()}
                            style={{
                                height: 48,
                                borderRadius: 10,
                                fontWeight: 600,
                                background: `linear-gradient(135deg, ${token.colorPrimary}, #06b6d4)`,
                                border: 'none',
                                boxShadow: '0 4px 16px rgba(8, 145, 178, 0.3)',
                                marginTop: 8,
                            }}
                        >
                            Sign in with Keycloak
                        </Button>

                        <Space size={4} style={{ marginTop: 8 }}>
                            <SafetyOutlined style={{ opacity: 0.4 }} />
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                Protected by Enterprise SSO | v2.0
                            </Text>
                        </Space>
                    </Space>
                </Card>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ duration: 1, delay: 0.6 }}
                    style={{ textAlign: 'center', marginTop: 24 }}
                >
                    <Text type="secondary" style={{ fontSize: 11, letterSpacing: 3, fontWeight: 500 }}>
                        GNN-POWERED GRAPH INTELLIGENCE
                    </Text>
                </motion.div>
            </motion.div>
        </div>
    );
}
