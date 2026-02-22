'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    Box, Button, TextField, Typography, Paper, Container, Stack, CircularProgress,
    FormControlLabel, Checkbox, RadioGroup, Radio, Divider, Link,
} from '@mui/material';
import { motion } from 'framer-motion';
import MemoryIcon from '@mui/icons-material/Memory';
import SecurityIcon from '@mui/icons-material/Security';
import BusinessIcon from '@mui/icons-material/Business';

const COLORS = {
    bg: '#020617',
    cyan: '#06b6d4',
    teal: '#14b8a6',
    blue: '#3b82f6',
    glass: 'rgba(15, 23, 42, 0.6)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
};

const inputSx = {
    '& .MuiOutlinedInput-root': {
        '& fieldset': { borderColor: COLORS.glassBorder },
        '&:hover fieldset': { borderColor: COLORS.cyan },
        '&.Mui-focused fieldset': { borderColor: COLORS.cyan },
        color: '#fff',
        background: 'rgba(0,0,0,0.2)',
    },
    '& .MuiInputLabel-root': { color: '#64748b' },
    '& .MuiInputLabel-root.Mui-focused': { color: COLORS.cyan },
};

const HolographicBackground = () => (
    <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1, overflow: 'hidden', pointerEvents: 'none', bgcolor: COLORS.bg }}>
        <Box
            sx={{
                position: 'absolute', width: '200%', height: '200%', top: '-50%', left: '-50%',
                backgroundImage: `
                    linear-gradient(${COLORS.glassBorder} 1px, transparent 1px),
                    linear-gradient(90deg, ${COLORS.glassBorder} 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
                transform: 'perspective(1000px) rotateX(60deg)',
                animation: 'gridMove 60s linear infinite',
                opacity: 0.1,
                maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)',
            }}
        />
        <style jsx global>{`
            @keyframes gridMove { 0% { transform: perspective(1000px) rotateX(60deg) translateY(0); } 100% { transform: perspective(1000px) rotateX(60deg) translateY(40px); } }
        `}</style>
    </Box>
);

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
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
        }}>
            <HolographicBackground />

            <Container maxWidth="xs">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <Paper sx={{
                        p: 5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        background: COLORS.glass,
                        backdropFilter: 'blur(20px)',
                        border: `1px solid ${COLORS.glassBorder}`,
                        borderRadius: '24px',
                        boxShadow: `0 0 50px -10px ${COLORS.blue}40`,
                    }}>
                        {/* Logo */}
                        <Box sx={{
                            mb: 2,
                            p: 2,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${COLORS.cyan}20, ${COLORS.blue}20)`,
                            border: `1px solid ${COLORS.cyan}40`,
                        }}>
                            <MemoryIcon sx={{ fontSize: 40, color: COLORS.cyan }} />
                        </Box>

                        <Typography component="h1" variant="h4" sx={{
                            fontWeight: 700,
                            mb: 0.5,
                            background: `linear-gradient(90deg, #fff, ${COLORS.cyan})`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            LayoutXpert.AI
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <BusinessIcon sx={{ color: '#64748b', fontSize: 16 }} />
                            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                                ChipDesign Corp.
                            </Typography>
                        </Box>

                        <Typography variant="caption" sx={{ color: '#475569', mb: 3 }}>
                            Enterprise Single Sign-On
                        </Typography>

                        {/* SSO Provider */}
                        <Box sx={{ width: '100%', mb: 2 }}>
                            <Typography variant="caption" sx={{ color: '#64748b', mb: 1, display: 'block' }}>
                                Authentication Provider
                            </Typography>
                            <RadioGroup
                                row
                                value={ssoProvider}
                                onChange={e => setSsoProvider(e.target.value)}
                                sx={{ gap: 0 }}
                            >
                                {[
                                    { value: 'ldap', label: 'Corporate LDAP' },
                                    { value: 'saml', label: 'SAML 2.0' },
                                    { value: 'azure', label: 'Azure AD' },
                                ].map(opt => (
                                    <FormControlLabel
                                        key={opt.value}
                                        value={opt.value}
                                        control={<Radio size="small" sx={{
                                            color: '#475569',
                                            '&.Mui-checked': { color: COLORS.cyan },
                                        }} />}
                                        label={<Typography variant="caption" sx={{ color: '#94a3b8' }}>{opt.label}</Typography>}
                                    />
                                ))}
                            </RadioGroup>
                        </Box>

                        <Divider sx={{ width: '100%', borderColor: COLORS.glassBorder, mb: 2 }} />

                        {/* Form */}
                        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                label="Corporate ID / Data Center Email"
                                autoComplete="email"
                                autoFocus
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                sx={{ ...inputSx, mb: 2 }}
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                label="Access Token / Password"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                sx={{ ...inputSx, mb: 1 }}
                            />

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={rememberMe}
                                            onChange={e => setRememberMe(e.target.checked)}
                                            sx={{ color: '#475569', '&.Mui-checked': { color: COLORS.cyan } }}
                                        />
                                    }
                                    label={<Typography variant="caption" sx={{ color: '#64748b' }}>Remember me</Typography>}
                                />
                                <Link
                                    href="#"
                                    underline="hover"
                                    sx={{ color: '#64748b', fontSize: '0.75rem', '&:hover': { color: COLORS.cyan } }}
                                    onClick={e => e.preventDefault()}
                                >
                                    Forgot password?
                                </Link>
                            </Box>

                            <Button
                                type="submit"
                                fullWidth
                                disabled={isLoading}
                                sx={{
                                    py: 1.5,
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    borderRadius: '12px',
                                    background: `linear-gradient(90deg, ${COLORS.cyan} 0%, ${COLORS.blue} 100%)`,
                                    boxShadow: `0 0 20px ${COLORS.cyan}40`,
                                    color: '#000',
                                    mb: 2,
                                    textTransform: 'none',
                                    '&:hover': {
                                        background: `linear-gradient(90deg, ${COLORS.cyan} 0%, ${COLORS.blue} 100%)`,
                                        filter: 'brightness(1.1)',
                                        boxShadow: `0 0 30px ${COLORS.cyan}60`,
                                    },
                                }}
                            >
                                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Authenticate'}
                            </Button>
                        </Box>

                        {/* Footer */}
                        <Divider sx={{ width: '100%', borderColor: COLORS.glassBorder, my: 2 }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SecurityIcon sx={{ color: '#334155', fontSize: 14 }} />
                            <Typography variant="caption" sx={{ color: '#334155' }}>
                                Protected by Enterprise SSO | v2.0
                            </Typography>
                        </Box>
                    </Paper>
                </motion.div>
            </Container>
        </Box>
    );
}
