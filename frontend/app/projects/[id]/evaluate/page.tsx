'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';

import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    BarChart, Bar,
    ScatterChart, Scatter, Cell as RechartsCell,
} from 'recharts';

import { getProjectReport, getExperimentReport, Report, SplitMetrics } from '@/lib/api';

const COLORS = {
    cyan: '#06b6d4',
    teal: '#14b8a6',
    blue: '#3b82f6',
    violet: '#8b5cf6',
    red: '#ef4444',
    green: '#22c55e',
    yellow: '#eab308',
    glass: 'rgba(15, 23, 42, 0.4)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
};

const glassCard = {
    bgcolor: COLORS.glass,
    backdropFilter: 'blur(20px)',
    border: `1px solid ${COLORS.glassBorder}`,
    borderRadius: 3,
    p: 3,
};

function MetricCard({ label, value, color }: { label: string; value: number | null; color: string }) {
    if (value === null || value === undefined) return null;
    return (
        <Paper sx={{ ...glassCard, textAlign: 'center', flex: 1, minWidth: 120 }}>
            <Typography variant="h4" sx={{ color, fontWeight: 800 }}>
                {typeof value === 'number' ? (value < 1 ? value.toFixed(4) : value.toFixed(2)) : value}
            </Typography>
            <Typography variant="caption" sx={{ color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' }}>
                {label}
            </Typography>
        </Paper>
    );
}

function MetricsRow({ label, metrics, color }: { label: string; metrics: SplitMetrics; color: string }) {
    const isClassification = metrics.accuracy !== null;
    return (
        <Box>
            <Typography variant="overline" sx={{ color, letterSpacing: 2, fontWeight: 700, mb: 1, display: 'block' }}>
                {label}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {isClassification ? (
                    <>
                        <MetricCard label="Accuracy" value={metrics.accuracy} color={color} />
                        <MetricCard label="F1 Score" value={metrics.f1_score} color={color} />
                        <MetricCard label="Precision" value={metrics.precision} color={color} />
                        <MetricCard label="Recall" value={metrics.recall} color={color} />
                    </>
                ) : (
                    <>
                        <MetricCard label="MSE" value={metrics.mse} color={color} />
                        <MetricCard label="MAE" value={metrics.mae} color={color} />
                        <MetricCard label="R² Score" value={metrics.r2_score} color={color} />
                    </>
                )}
            </Box>
        </Box>
    );
}

export default function EvaluatePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const projectId = params.id as string;
    const taskIdParam = searchParams.get('task_id');

    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!projectId) return;
        setLoading(true);
        const fetchReport = taskIdParam
            ? getExperimentReport(projectId, taskIdParam)
            : getProjectReport(projectId);
        fetchReport
            .then(setReport)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [projectId, taskIdParam]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress sx={{ color: COLORS.cyan }} />
            </Box>
        );
    }

    if (error || !report) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Alert severity="error">{error || 'Report not available. Training may not be completed.'}</Alert>
            </Container>
        );
    }

    const isClassification = report.task_type.includes('classification');

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800 }}>
                        MODEL EVALUATION
                    </Typography>
                    <Typography sx={{ color: '#94a3b8' }}>
                        Task: {report.task_type.replace('_', ' ').toUpperCase()}
                    </Typography>
                </Box>
                {report.best_config && (
                    <Chip
                        icon={<EmojiEventsIcon />}
                        label={`Best: ${report.best_config.model_name.toUpperCase()}`}
                        sx={{ bgcolor: 'rgba(234, 179, 8, 0.15)', color: COLORS.yellow, fontWeight: 700, fontSize: '0.9rem', height: 36 }}
                    />
                )}
            </Box>

            <Stack spacing={4}>
                {/* ── Performance Metrics ── */}
                <Paper sx={glassCard}>
                    <Typography variant="overline" sx={{ color: COLORS.cyan, letterSpacing: 2, fontWeight: 700, mb: 3, display: 'block' }}>
                        PERFORMANCE METRICS
                    </Typography>
                    <Stack spacing={3}>
                        <MetricsRow label="Training" metrics={report.train_metrics} color={COLORS.cyan} />
                        {report.val_metrics && (
                            <MetricsRow label="Validation" metrics={report.val_metrics} color={COLORS.violet} />
                        )}
                        <MetricsRow label="Test" metrics={report.test_metrics} color={COLORS.teal} />
                    </Stack>
                </Paper>

                {/* ── Task-Specific Chart ── */}
                {isClassification && report.confusion_matrix && (
                    <Paper sx={glassCard}>
                        <Typography variant="overline" sx={{ color: COLORS.cyan, letterSpacing: 2, fontWeight: 700, mb: 2, display: 'block' }}>
                            CONFUSION MATRIX
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 1, maxWidth: 500, mx: 'auto' }}>
                            {/* Header */}
                            <Box />
                            <Box sx={{ textAlign: 'center', p: 1 }}>
                                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Pred. Negative</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center', p: 1 }}>
                                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Pred. Positive</Typography>
                            </Box>
                            {/* Rows */}
                            {report.confusion_matrix.map((row, i) => (
                                <React.Fragment key={i}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
                                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>{row.actual}</Typography>
                                    </Box>
                                    {/* predicted_negative: correct if actual=Negative, wrong if actual=Positive */}
                                    <Box sx={{
                                        textAlign: 'center', p: 2, borderRadius: 2,
                                        bgcolor: row.actual === 'Negative' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    }}>
                                        <Typography variant="h5" sx={{ color: row.actual === 'Negative' ? COLORS.green : COLORS.red, fontWeight: 700 }}>
                                            {row.predicted_negative}
                                        </Typography>
                                    </Box>
                                    {/* predicted_positive: correct if actual=Positive, wrong if actual=Negative */}
                                    <Box sx={{
                                        textAlign: 'center', p: 2, borderRadius: 2,
                                        bgcolor: row.actual === 'Positive' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    }}>
                                        <Typography variant="h5" sx={{ color: row.actual === 'Positive' ? COLORS.green : COLORS.red, fontWeight: 700 }}>
                                            {row.predicted_positive}
                                        </Typography>
                                    </Box>
                                </React.Fragment>
                            ))}
                        </Box>
                    </Paper>
                )}

                {!isClassification && report.residual_data && report.residual_data.length > 0 && (
                    <Paper sx={glassCard}>
                        <Typography variant="overline" sx={{ color: COLORS.cyan, letterSpacing: 2, fontWeight: 700, mb: 2, display: 'block' }}>
                            RESIDUAL PLOT (ACTUAL vs PREDICTED)
                        </Typography>
                        <ResponsiveContainer width="100%" height={350}>
                            <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="actual" name="Actual" tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Actual', fill: '#64748b', position: 'bottom' }} />
                                <YAxis dataKey="predicted" name="Predicted" tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Predicted', fill: '#64748b', angle: -90, position: 'left' }} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: `1px solid ${COLORS.glassBorder}`, color: '#fff' }} />
                                <Scatter data={report.residual_data} fill={COLORS.cyan} opacity={0.6} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </Paper>
                )}

                {/* ── Training History ── */}
                {report.history && report.history.length > 0 && (
                    <Paper sx={glassCard}>
                        <Typography variant="overline" sx={{ color: COLORS.cyan, letterSpacing: 2, fontWeight: 700, mb: 2, display: 'block' }}>
                            TRAINING HISTORY
                        </Typography>
                        <ResponsiveContainer width="100%" height={340}>
                            <LineChart data={report.history} margin={{ top: 5, right: 10, bottom: 25, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="epoch" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'Epoch', fill: '#64748b', position: 'insideBottom', offset: -15 }} />
                                <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} />
                                {isClassification && (
                                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 1]} />
                                )}
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: `1px solid ${COLORS.glassBorder}`, color: '#fff' }} />
                                <Legend verticalAlign="top" />
                                <Line type="monotone" dataKey="loss" name="Train Loss" stroke={COLORS.cyan} strokeWidth={2} dot={false} yAxisId="left" />
                                <Line type="monotone" dataKey="val_loss" name="Val Loss" stroke={COLORS.teal} strokeWidth={2} dot={false} yAxisId="left" />
                                {isClassification && (
                                    <Line type="monotone" dataKey="accuracy" name="Accuracy" stroke={COLORS.green} strokeWidth={2} dot={false} yAxisId="right" />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                )}

                {/* ── Best Config ── */}
                {report.best_config && (
                    <Paper sx={glassCard}>
                        <Typography variant="overline" sx={{ color: COLORS.cyan, letterSpacing: 2, fontWeight: 700, mb: 2, display: 'block' }}>
                            BEST MODEL CONFIGURATION
                        </Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        {['Model', 'Hidden Dim', 'Num Layers', 'Dropout', 'Learning Rate'].map(h => (
                                            <TableCell key={h} sx={{ color: '#94a3b8', borderColor: COLORS.glassBorder, fontWeight: 700 }}>
                                                {h}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableRow>
                                        <TableCell sx={{ color: COLORS.cyan, borderColor: COLORS.glassBorder, fontWeight: 700 }}>
                                            {report.best_config.model_name.toUpperCase()}
                                        </TableCell>
                                        <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder }}>{report.best_config.hidden_dim}</TableCell>
                                        <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder }}>{report.best_config.num_layers}</TableCell>
                                        <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder }}>{report.best_config.dropout}</TableCell>
                                        <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder }}>{report.best_config.lr}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                )}

                {/* ── Leaderboard ── */}
                {report.leaderboard && report.leaderboard.length > 0 && (
                    <Paper sx={glassCard}>
                        <Typography variant="overline" sx={{ color: COLORS.cyan, letterSpacing: 2, fontWeight: 700, mb: 2, display: 'block' }}>
                            TRAINING LEADERBOARD
                        </Typography>
                        <TableContainer sx={{ maxHeight: 500 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        {['Rank', 'Trial', 'Model', 'Hidden Dim', 'Layers', 'Dropout', 'LR', 'Val Loss'].map(h => (
                                            <TableCell key={h} sx={{
                                                color: '#94a3b8', fontWeight: 700, fontSize: '0.75rem',
                                                bgcolor: '#0f172a', borderColor: COLORS.glassBorder,
                                            }}>
                                                {h}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {report.leaderboard.map((entry, i) => (
                                        <TableRow key={entry.trial} sx={{
                                            bgcolor: i === 0 ? 'rgba(234, 179, 8, 0.05)' : 'transparent',
                                            '&:hover': { bgcolor: 'rgba(6, 182, 212, 0.05)' },
                                        }}>
                                            <TableCell sx={{ color: i === 0 ? COLORS.yellow : '#fff', borderColor: COLORS.glassBorder, fontWeight: i === 0 ? 700 : 400 }}>
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                            </TableCell>
                                            <TableCell sx={{ color: '#94a3b8', borderColor: COLORS.glassBorder }}>{entry.trial}</TableCell>
                                            <TableCell sx={{ color: COLORS.cyan, borderColor: COLORS.glassBorder, fontWeight: 600 }}>{entry.model.toUpperCase()}</TableCell>
                                            <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder }}>{entry.hidden_dim}</TableCell>
                                            <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder }}>{entry.num_layers}</TableCell>
                                            <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder }}>{entry.dropout}</TableCell>
                                            <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder }}>{entry.lr}</TableCell>
                                            <TableCell sx={{ color: i === 0 ? COLORS.green : '#fff', borderColor: COLORS.glassBorder, fontWeight: 600 }}>
                                                {entry.val_loss.toFixed(4)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                )}
            </Stack>
        </Container>
    );
}
