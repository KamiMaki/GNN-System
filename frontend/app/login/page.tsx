'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Input, Radio, Checkbox, Divider, Typography, Spin, Space } from 'antd';
import { AppstoreOutlined, SafetyOutlined, BankOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';

const { Title, Text, Link } = Typography;

export default function LoginPage() {
    const { login, isLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [ssoProvider, setSsoProvider] = useState('ldap');
    const [rememberMe, setRememberMe] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await login();
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <Card style={{ width: 420, textAlign: 'center' }}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <AppstoreOutlined style={{ fontSize: 40 }} />
                        <Title level={3} style={{ margin: 0 }}>LayoutXpert.AI</Title>
                        <Space size={4}>
                            <BankOutlined />
                            <Text type="secondary">ChipDesign Corp.</Text>
                        </Space>
                        <Text type="secondary">Enterprise Single Sign-On</Text>

                        <div style={{ textAlign: 'left' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>Authentication Provider</Text>
                            <Radio.Group
                                value={ssoProvider}
                                onChange={e => setSsoProvider(e.target.value)}
                                style={{ marginTop: 8 }}
                            >
                                <Radio value="ldap">Corporate LDAP</Radio>
                                <Radio value="saml">SAML 2.0</Radio>
                                <Radio value="azure">Azure AD</Radio>
                            </Radio.Group>
                        </div>

                        <Divider style={{ margin: '8px 0' }} />

                        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                <Input
                                    placeholder="Corporate ID / Data Center Email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    autoFocus
                                    size="large"
                                />
                                <Input.Password
                                    placeholder="Access Token / Password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    size="large"
                                />

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
                                >
                                    Authenticate
                                </Button>
                            </Space>
                        </form>

                        <Divider style={{ margin: '8px 0' }} />
                        <Space size={4}>
                            <SafetyOutlined style={{ opacity: 0.5 }} />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Protected by Enterprise SSO | v2.0
                            </Text>
                        </Space>
                    </Space>
                </Card>
            </motion.div>
        </div>
    );
}
