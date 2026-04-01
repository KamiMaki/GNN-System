'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isKeycloakMode } from '@/lib/auth-mode';
import { Card, Button, Input, Radio, Checkbox, Divider, Typography, Space, theme } from 'antd';
import { SafetyOutlined, BankOutlined, ThunderboltOutlined, KeyOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import Image from 'next/image';

const { Title, Text, Link } = Typography;

export default function LoginPage() {
    const { login, isLoading, user } = useAuth();
    const { token } = theme.useToken();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [ssoProvider, setSsoProvider] = useState('ldap');
    const [rememberMe, setRememberMe] = useState(false);

    // In keycloak mode, if user is already logged in, redirect to dashboard
    useEffect(() => {
        if (isKeycloakMode && user) {
            window.location.href = '/dashboard';
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await login();
    };

    const handleKeycloakLogin = async () => {
        await login();
    };

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
                                boxShadow: `0 8px 32px rgba(8, 145, 178, 0.3)`,
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

                        <Text type="secondary" style={{ fontSize: 13 }}>Enterprise Single Sign-On</Text>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            style={{ textAlign: 'left' }}
                        >
                            <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Authentication Provider</Text>
                            <Radio.Group
                                value={ssoProvider}
                                onChange={e => setSsoProvider(e.target.value)}
                                style={{ marginTop: 8 }}
                            >
                                <Radio value="ldap">Corporate LDAP</Radio>
                                <Radio value="saml">SAML 2.0</Radio>
                                <Radio value="azure">Azure AD</Radio>
                            </Radio.Group>
                        </motion.div>

                        <Divider style={{ margin: '4px 0' }} />

                        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                                        Corporate ID
                                    </Text>
                                    <Input
                                        placeholder="username@chipdesign.corp"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        autoFocus
                                        size="large"
                                        style={{ borderRadius: 10 }}
                                    />
                                </div>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                                        Access Token
                                    </Text>
                                    <Input.Password
                                        placeholder="Enter your access token"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        size="large"
                                        style={{ borderRadius: 10 }}
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Checkbox
                                        checked={rememberMe}
                                        onChange={e => setRememberMe(e.target.checked)}
                                    >
                                        <Text type="secondary" style={{ fontSize: 12 }}>Remember me</Text>
                                    </Checkbox>
                                    <Link style={{ fontSize: 12 }} onClick={e => e?.preventDefault()}>
                                        Forgot password?
                                    </Link>
                                </div>

                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    block
                                    size="large"
                                    loading={isLoading}
                                    icon={<ThunderboltOutlined />}
                                    style={{
                                        height: 44,
                                        borderRadius: 10,
                                        fontWeight: 600,
                                        background: `linear-gradient(135deg, ${token.colorPrimary}, #06b6d4)`,
                                        border: 'none',
                                        boxShadow: '0 4px 16px rgba(8, 145, 178, 0.3)',
                                    }}
                                >
                                    Authenticate
                                </Button>
                            </Space>
                        </form>

                        {isKeycloakMode && (
                            <>
                                <Divider style={{ margin: '4px 0' }}>
                                    <Text type="secondary" style={{ fontSize: 11 }}>OR</Text>
                                </Divider>
                                <Button
                                    block
                                    size="large"
                                    icon={<KeyOutlined />}
                                    onClick={handleKeycloakLogin}
                                    loading={isLoading}
                                    style={{
                                        height: 44,
                                        borderRadius: 10,
                                        fontWeight: 600,
                                    }}
                                >
                                    Sign in with Keycloak SSO
                                </Button>
                            </>
                        )}

                        <Divider style={{ margin: '4px 0' }} />
                        <Space size={4}>
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
