// components/DataSummaryCard.tsx
'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';

interface DataSummary {
    dataset_id: string;
    num_nodes: number;
    num_edges: number;
    num_features: number;
    num_classes: number | string;
    is_directed: boolean;
}

interface DataSummaryCardProps {
    summary: DataSummary;
}

const StatItem = ({ label, value, highlight = false }: { label: string; value: string | number, highlight?: boolean }) => (
    <Box
        sx={{
            p: 2,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            height: '100%',
            transition: 'transform 0.2s',
            '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: highlight ? 'rgba(0, 242, 255, 0.3)' : 'rgba(255,255,255,0.1)',
            }
        }}
    >
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>{label}</Typography>
        <Typography
            variant="h5"
            component="span"
            sx={{
                fontWeight: 700,
                // 高亮數據使用霓虹色
                color: highlight ? '#00f2ff' : 'text.primary',
                textShadow: highlight ? '0 0 10px rgba(0, 242, 255, 0.3)' : 'none'
            }}
        >
            {value}
        </Typography>
    </Box>
);

export default function DataSummaryCard({ summary }: DataSummaryCardProps) {
    return (
        <Card sx={{ mt: 4, position: 'relative', overflow: 'hidden' }}>
            {/* 背景裝飾：流動的光影 */}
            <Box sx={{
                position: 'absolute',
                top: '-50%', left: '-20%', width: '50%', height: '100%',
                background: 'radial-gradient(circle, rgba(0, 242, 255, 0.1) 0%, rgba(0,0,0,0) 70%)',
                transform: 'rotate(-30deg)',
                pointerEvents: 'none',
            }} />

            <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <AutoGraphIcon sx={{ color: '#00f2ff', mr: 2, fontSize: 32 }} />
                    <Typography
                        variant="h5"
                        component="div"
                        sx={{ fontWeight: 700 }}
                    >
                        Dataset Exploration Results
                    </Typography>
                </Box>

                <Chip
                    label={`ID: ${summary.dataset_id}`}
                    sx={{
                        mb: 4,
                        background: 'rgba(112, 0, 255, 0.1)',
                        color: '#b026ff',
                        border: '1px solid rgba(112, 0, 255, 0.3)',
                        fontWeight: 600
                    }}
                />

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3 }}>
                    <Box>
                        <StatItem label="Total Nodes" value={summary.num_nodes.toLocaleString()} highlight />
                    </Box>
                    <Box>
                        <StatItem label="Total Edges" value={summary.num_edges.toLocaleString()} highlight />
                    </Box>
                    <Box>
                        <StatItem label="Node Features" value={summary.num_features} />
                    </Box>
                    <Box>
                        <StatItem label="Classes" value={summary.num_classes} />
                    </Box>
                    <Box>
                        <StatItem label="Structure" value={summary.is_directed ? 'Directed' : 'Undirected'} />
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}