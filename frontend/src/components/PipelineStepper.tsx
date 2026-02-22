'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepButton from '@mui/material/StepButton';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import MemoryIcon from '@mui/icons-material/Memory';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const STEPS = [
    { label: 'Upload Data', description: 'Upload graph CSV files' },
    { label: 'Data Analysis', description: 'Explore & configure' },
    { label: 'Training', description: 'Model training & HPO' },
    { label: 'Evaluation', description: 'Results & metrics' },
];

const COLORS = {
    cyan: '#06b6d4',
    teal: '#14b8a6',
    glass: 'rgba(15, 23, 42, 0.6)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
};

interface PipelineStepperProps {
    currentStep: number;
    projectName: string;
    projectId: string;
    status?: string;
}

export default function PipelineStepper({ currentStep, projectName, projectId, status }: PipelineStepperProps) {
    const router = useRouter();
    const { user, logout } = useAuth();
    const activeIndex = currentStep - 1;

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(anchorEl);

    const stepPaths = [
        `/projects/${projectId}/upload`,
        `/projects/${projectId}/explore`,
        `/projects/${projectId}/train`,
        `/projects/${projectId}/evaluate`,
    ];

    const handleStepClick = (index: number) => {
        router.push(stepPaths[index]);
    };

    return (
        <Box sx={{
            py: 1.5,
            px: 3,
            background: COLORS.glass,
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${COLORS.glassBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
        }}>
            {/* Branded Home Button */}
            <Button
                onClick={() => router.push('/dashboard')}
                startIcon={<MemoryIcon />}
                sx={{
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: '1rem',
                    letterSpacing: '-0.02em',
                    flexShrink: 0,
                    '&:hover': { bgcolor: 'rgba(6, 182, 212, 0.1)' },
                    '& .MuiButton-startIcon': { color: COLORS.cyan },
                }}
            >
                LayoutXpert
            </Button>

            <Box sx={{ width: '1px', height: 28, bgcolor: COLORS.glassBorder, flexShrink: 0 }} />

            {/* Breadcrumbs */}
            <Breadcrumbs
                separator={<NavigateNextIcon sx={{ fontSize: 14, color: '#475569' }} />}
                sx={{ flexShrink: 0, minWidth: 0 }}
            >
                <Link
                    href="/dashboard"
                    underline="hover"
                    sx={{ color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', '&:hover': { color: '#94a3b8' } }}
                    onClick={(e) => { e.preventDefault(); router.push('/dashboard'); }}
                >
                    Dashboard
                </Link>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', maxWidth: 120 }} noWrap>
                    {projectName}
                </Typography>
                <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>
                    {STEPS[activeIndex]?.label}
                </Typography>
            </Breadcrumbs>

            {status && (
                <Chip
                    label={status.replace('_', ' ').toUpperCase()}
                    size="small"
                    sx={{
                        fontSize: '0.6rem',
                        height: 20,
                        flexShrink: 0,
                        bgcolor: status === 'completed' ? 'rgba(34, 197, 94, 0.15)' :
                            status === 'failed' ? 'rgba(239, 68, 68, 0.15)' :
                                status === 'training' ? 'rgba(6, 182, 212, 0.15)' :
                                    'rgba(148, 163, 184, 0.15)',
                        color: status === 'completed' ? '#22c55e' :
                            status === 'failed' ? '#ef4444' :
                                status === 'training' ? COLORS.cyan :
                                    '#94a3b8',
                        border: 'none',
                    }}
                />
            )}

            {/* Stepper */}
            <Stepper
                activeStep={activeIndex}
                sx={{
                    flex: 1,
                    '& .MuiStepConnector-line': {
                        borderColor: COLORS.glassBorder,
                    },
                    '& .MuiStepConnector-root.Mui-active .MuiStepConnector-line': {
                        borderColor: COLORS.cyan,
                    },
                    '& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line': {
                        borderColor: COLORS.teal,
                    },
                }}
            >
                {STEPS.map((step, index) => (
                    <Step key={step.label} completed={index < activeIndex}>
                        <Tooltip
                            title={index > activeIndex ? 'Click to jump to this step' : ''}
                            arrow
                            placement="bottom"
                        >
                            <StepButton
                                onClick={() => handleStepClick(index)}
                                sx={{
                                    cursor: 'pointer',
                                    borderRadius: 1,
                                    transition: 'background 0.2s',
                                    '&:hover': { bgcolor: 'rgba(6, 182, 212, 0.08)' },
                                    '& .MuiStepLabel-label': {
                                        color: index <= activeIndex ? '#fff' : '#64748b',
                                        fontWeight: index === activeIndex ? 700 : 400,
                                        fontSize: '0.8rem',
                                        '&.Mui-active': { color: COLORS.cyan },
                                        '&.Mui-completed': { color: COLORS.teal },
                                    },
                                    '& .MuiStepIcon-root': {
                                        color: index < activeIndex ? COLORS.teal :
                                            index === activeIndex ? COLORS.cyan : '#334155',
                                        '&.Mui-active': { color: COLORS.cyan },
                                        '&.Mui-completed': { color: COLORS.teal },
                                    },
                                }}
                            >
                                <StepLabel>
                                    {step.label}
                                </StepLabel>
                            </StepButton>
                        </Tooltip>
                    </Step>
                ))}
            </Stepper>

            {/* User Avatar & Menu */}
            {user && (
                <>
                    <Button
                        onClick={(e) => setAnchorEl(e.currentTarget)}
                        sx={{
                            minWidth: 0,
                            p: 0.5,
                            borderRadius: '50%',
                            flexShrink: 0,
                        }}
                    >
                        <Avatar
                            src={user.avatar}
                            alt={user.name}
                            sx={{ width: 32, height: 32, border: `2px solid ${COLORS.glassBorder}` }}
                        />
                    </Button>
                    <Menu
                        anchorEl={anchorEl}
                        open={menuOpen}
                        onClose={() => setAnchorEl(null)}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        slotProps={{
                            paper: {
                                sx: {
                                    bgcolor: '#0f172a',
                                    border: `1px solid ${COLORS.glassBorder}`,
                                    backdropFilter: 'blur(20px)',
                                    mt: 1,
                                    minWidth: 200,
                                },
                            },
                        }}
                    >
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{user.name}</Typography>
                            <Typography sx={{ color: '#64748b', fontSize: '0.75rem' }}>{user.email}</Typography>
                        </Box>
                        <Divider sx={{ borderColor: COLORS.glassBorder }} />
                        <MenuItem onClick={() => setAnchorEl(null)} sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                            <ListItemIcon><PersonIcon sx={{ color: '#64748b', fontSize: 18 }} /></ListItemIcon>
                            Profile
                        </MenuItem>
                        <MenuItem onClick={() => setAnchorEl(null)} sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                            <ListItemIcon><SettingsIcon sx={{ color: '#64748b', fontSize: 18 }} /></ListItemIcon>
                            Settings
                        </MenuItem>
                        <Divider sx={{ borderColor: COLORS.glassBorder }} />
                        <MenuItem onClick={() => { setAnchorEl(null); logout(); }} sx={{ color: '#ef4444', fontSize: '0.85rem' }}>
                            <ListItemIcon><LogoutIcon sx={{ color: '#ef4444', fontSize: 18 }} /></ListItemIcon>
                            Logout
                        </MenuItem>
                    </Menu>
                </>
            )}
        </Box>
    );
}
