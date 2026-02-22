// src/components/KPICard.tsx

import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
// ✅ 使用 MUI Icons
import AccessTimeIcon from '@mui/icons-material/AccessTime';     // 對應 Clock
import TrendingUpIcon from '@mui/icons-material/TrendingUp';     // 對應 TrendingUp
import WarningAmberIcon from '@mui/icons-material/WarningAmber'; // 對應 AlertTriangle
import BoltIcon from '@mui/icons-material/Bolt';                 // 對應 Zap

// 注意：MUI Icon 不使用 size prop，而是用 sx={{ fontSize: ... }}
const getIcon = (title: string) => {
    switch (title) {
        case 'Predicted Critical Delay (ns)':
            return <AccessTimeIcon sx={{ fontSize: 28, color: '#b026ff' }} />;
        case 'Layout Score (0-100)':
            return <TrendingUpIcon sx={{ fontSize: 28, color: '#00f2ff' }} />;
        case 'Hotspots Detected':
            return <WarningAmberIcon sx={{ fontSize: 28, color: '#f93d6c' }} />;
        case 'Potential Timing Violations':
            return <WarningAmberIcon sx={{ fontSize: 28, color: '#f93d6c' }} />;
        default:
            return <BoltIcon sx={{ fontSize: 28, color: '#fff' }} />;
    }
};

export default function KPICard({ title, value, color }: { title: string, value: number, color: string }) {
    return (
        <Paper 
            elevation={3} 
            sx={{ 
                p: 3, 
                backgroundColor: '#161b22', 
                border: `1px solid ${color}40`, 
                borderLeft: `5px solid ${color}`,
                transition: 'transform 0.3s',
                '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: `0 0 15px ${color}30`,
                }
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                {getIcon(title)}
                <Typography 
                    variant="subtitle2" 
                    sx={{ ml: 1.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}
                >
                    {title}
                </Typography>
            </Box>
            <Typography 
                variant="h4" 
                sx={{ 
                    fontWeight: 700, 
                    color: color,
                    mt: 1, 
                    fontSize: '2rem' 
                }}
            >
                {/* 簡單的數值格式化 */}
                {typeof value === 'number' ? value.toFixed(2) : value}
                {title.includes('(ns)') ? ' ns' : ''}
            </Typography>
        </Paper>
    );
}