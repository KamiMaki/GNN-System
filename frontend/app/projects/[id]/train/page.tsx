'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Slider from '@mui/material/Slider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MemoryIcon from '@mui/icons-material/Memory';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import {
    estimateTraining, startProjectTraining, getProjectStatus, getProject,
    listExperiments,
    TaskStatus, TrainingEstimate, ProjectDetail,
} from '@/lib/api';

const COLORS = {
    cyan: '#06b6d4',
    teal: '#14b8a6',
    green: '#22c55e',
    red: '#ef4444',
    yellow: '#eab308',
    glass: 'rgba(15, 23, 42, 0.4)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
};

const ALL_MODELS = ['gcn', 'gat', 'sage', 'gin', 'mlp'];

const glassCard = {
    bgcolor: COLORS.glass,
    backdropFilter: 'blur(20px)',
    border: `1px solid ${COLORS.glassBorder}`,
    borderRadius: 3,
    p: 3,
};

function formatTime(seconds: number): string {
    if (seconds < 0) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

export default function TrainPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [project, setProject] = useState<ProjectDetail | null>(null);

    // Config
    const [autoMode, setAutoMode] = useState(true);
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [nTrials, setNTrials] = useState(150);
    const [estimate, setEstimate] = useState<TrainingEstimate | null>(null);
    const [estimateLoading, setEstimateLoading] = useState(false);

    // Training state
    const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
    const [training, setTraining] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const logRef = useRef<HTMLDivElement>(null);
    const lastLogKey = useRef<string>('');

    // Timer
    const [elapsed, setElapsed] = useState(0);

    // Experiment history
    const [experiments, setExperiments] = useState<TaskStatus[]>([]);

    // Edge attribute warning
    const hasEdgeAttrs = project?.dataset_summary?.has_edge_attrs;

    // Load project
    useEffect(() => {
        if (!projectId) return;
        getProject(projectId).then(p => {
            setProject(p);
            if (p.task_status && p.task_status.status !== 'COMPLETED' && p.task_status.status !== 'FAILED') {
                setTaskStatus(p.task_status);
                setTraining(true);
            } else if (p.task_status) {
                setTaskStatus(p.task_status);
            }
        }).catch(console.error);

        // Load experiment history
        listExperiments(projectId).then(setExperiments).catch(console.error);
    }, [projectId]);

    // Estimate training time when config changes
    useEffect(() => {
        if (!projectId) return;
        setEstimateLoading(true);
        estimateTraining(projectId, nTrials)
            .then(setEstimate)
            .catch(console.error)
            .finally(() => setEstimateLoading(false));
    }, [projectId, nTrials]);

    // Poll training status
    useEffect(() => {
        if (!training || !projectId) return;

        const poll = async () => {
            try {
                const status = await getProjectStatus(projectId);
                setTaskStatus(status);

                const key = `${status.status}|${status.progress}|${status.current_trial}`;
                if (key !== lastLogKey.current) {
                    lastLogKey.current = key;
                    const logLine = `[${new Date().toLocaleTimeString()}] ${status.status} - Progress: ${status.progress}%` +
                        (status.current_trial ? ` (Trial ${status.current_trial}/${status.total_trials})` : '');
                    setLogs(prev => [...prev, logLine]);
                }

                if (status.status === 'COMPLETED') {
                    setTraining(false);
                    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Training completed!`]);
                    // Refresh experiment list
                    listExperiments(projectId).then(setExperiments).catch(console.error);
                } else if (status.status === 'FAILED') {
                    setTraining(false);
                    setError('Training failed. Check logs for details.');
                    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Training FAILED`]);
                    listExperiments(projectId).then(setExperiments).catch(console.error);
                }
            } catch (err) {
                console.error(err);
            }
        };

        pollRef.current = setInterval(poll, 2000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [training, projectId]);

    // Elapsed timer based on started_at
    useEffect(() => {
        const startedAt = taskStatus?.started_at;
        if (!startedAt || (!training && taskStatus?.status !== 'COMPLETED')) return;

        if (taskStatus?.status === 'COMPLETED' && taskStatus?.results) {
            setElapsed(taskStatus.results.training_time_seconds);
            return;
        }

        const startTime = new Date(startedAt).getTime();
        const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [taskStatus?.started_at, training, taskStatus?.status]);

    // Auto-scroll logs
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [logs]);

    const handleStart = async () => {
        setError(null);
        setLogs([`[${new Date().toLocaleTimeString()}] Starting training...`]);
        lastLogKey.current = '';
        try {
            const models = autoMode ? [] : selectedModels;
            const status = await startProjectTraining(projectId, models, nTrials);
            setTaskStatus(status);
            setTraining(true);
        } catch (err: any) {
            setError(err.message || 'Failed to start training');
        }
    };

    const isCompleted = taskStatus?.status === 'COMPLETED';
    const isFailed = taskStatus?.status === 'FAILED';
    const isRunning = training && !isCompleted && !isFailed;

    const progress = taskStatus?.progress || 0;
    const estimatedRemaining = progress > 0 && isRunning
        ? Math.max(0, elapsed * (100 - progress) / progress)
        : -1;

    // Edge attr warning for MLP
    const showEdgeAttrWarning = hasEdgeAttrs && !autoMode && selectedModels.includes('mlp');

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
                MODEL TRAINING
            </Typography>
            <Typography sx={{ color: '#94a3b8', mb: 4 }}>
                Configure and run GNN model training with automated hyperparameter optimization.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                {/* Left: Configuration */}
                <Stack spacing={3}>
                    {/* Model Selection */}
                    <Paper sx={glassCard}>
                        <Typography variant="subtitle2" sx={{ color: COLORS.cyan, fontWeight: 700, mb: 2 }}>
                            MODEL SELECTION
                        </Typography>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={autoMode}
                                    onChange={e => setAutoMode(e.target.checked)}
                                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: COLORS.cyan }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: COLORS.cyan } }}
                                />
                            }
                            label={<Typography sx={{ color: '#94a3b8' }}>Auto (search all models)</Typography>}
                        />

                        {!autoMode && (
                            <ToggleButtonGroup
                                value={selectedModels}
                                onChange={(_, vals) => setSelectedModels(vals)}
                                sx={{
                                    mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1,
                                    '& .MuiToggleButton-root': {
                                        color: '#64748b', borderColor: COLORS.glassBorder, textTransform: 'uppercase', fontWeight: 700, fontSize: '0.8rem',
                                        '&.Mui-selected': { color: COLORS.cyan, bgcolor: 'rgba(6, 182, 212, 0.15)', borderColor: COLORS.cyan },
                                    },
                                }}
                            >
                                {ALL_MODELS.map(m => (
                                    <Tooltip
                                        key={m}
                                        title={hasEdgeAttrs && m === 'mlp' ? 'MLP does not use edge attributes' : ''}
                                        arrow
                                    >
                                        <ToggleButton value={m}>{m}</ToggleButton>
                                    </Tooltip>
                                ))}
                            </ToggleButtonGroup>
                        )}

                        {showEdgeAttrWarning && (
                            <Alert
                                severity="warning"
                                icon={<WarningAmberIcon />}
                                sx={{ mt: 2, bgcolor: 'rgba(234, 179, 8, 0.1)', color: COLORS.yellow }}
                            >
                                MLP baseline does not use edge attributes. Consider using GCN, GAT, or GraphSAGE for better results with edge features.
                            </Alert>
                        )}
                    </Paper>

                    {/* Trial Count */}
                    <Paper sx={glassCard}>
                        <Typography variant="subtitle2" sx={{ color: COLORS.cyan, fontWeight: 700, mb: 2 }}>
                            OPTUNA TRIALS
                        </Typography>
                        <Box sx={{ px: 2 }}>
                            <Slider
                                value={nTrials}
                                onChange={(_, val) => setNTrials(val as number)}
                                min={10}
                                max={300}
                                step={10}
                                disabled={isRunning}
                                valueLabelDisplay="on"
                                sx={{
                                    color: COLORS.cyan,
                                    '& .MuiSlider-valueLabel': { bgcolor: COLORS.cyan },
                                }}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>10</Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>300</Typography>
                        </Box>
                    </Paper>

                    {/* Estimate & Device */}
                    <Paper sx={glassCard}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TimerIcon sx={{ color: COLORS.cyan }} />
                                <Typography sx={{ color: '#94a3b8' }}>Estimated Time:</Typography>
                                {estimateLoading ? (
                                    <CircularProgress size={16} sx={{ color: COLORS.cyan }} />
                                ) : estimate ? (
                                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                                        ~{formatTime(estimate.estimated_seconds)}
                                    </Typography>
                                ) : null}
                            </Box>
                            <Chip
                                icon={<MemoryIcon />}
                                label={estimate?.device?.toUpperCase() || 'CPU'}
                                sx={{
                                    bgcolor: estimate?.device === 'cuda' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                    color: estimate?.device === 'cuda' ? COLORS.green : '#94a3b8',
                                    fontWeight: 700,
                                }}
                            />
                        </Box>
                    </Paper>

                    {/* Start Button — always show when not running */}
                    {!isRunning && (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<PlayArrowIcon />}
                            onClick={handleStart}
                            disabled={!autoMode && selectedModels.length === 0}
                            sx={{
                                py: 1.5, fontWeight: 700, fontSize: '1rem',
                                bgcolor: COLORS.cyan, borderRadius: 2,
                                '&:hover': { bgcolor: COLORS.teal },
                            }}
                        >
                            {experiments.length > 0 ? 'Start New Training' : 'Start Training'}
                        </Button>
                    )}

                    {isCompleted && (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => router.push(`/projects/${projectId}/evaluate`)}
                            sx={{
                                py: 1.5, fontWeight: 700, fontSize: '1rem',
                                bgcolor: COLORS.green, borderRadius: 2,
                            }}
                        >
                            View Latest Results
                        </Button>
                    )}

                    {error && <Alert severity="error">{error}</Alert>}
                </Stack>

                {/* Right: Progress & Logs */}
                <Stack spacing={3}>
                    {/* Progress */}
                    {taskStatus && (
                        <Paper sx={glassCard}>
                            <Typography variant="subtitle2" sx={{ color: COLORS.cyan, fontWeight: 700, mb: 2 }}>
                                TRAINING PROGRESS
                            </Typography>

                            <Box sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography sx={{ color: '#94a3b8' }}>{taskStatus.status}</Typography>
                                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>{taskStatus.progress}%</Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={taskStatus.progress}
                                    sx={{
                                        height: 8, borderRadius: 4,
                                        bgcolor: '#1e293b',
                                        '& .MuiLinearProgress-bar': {
                                            bgcolor: isCompleted ? COLORS.green : isFailed ? COLORS.red : COLORS.cyan,
                                            borderRadius: 4,
                                        },
                                    }}
                                />
                            </Box>

                            {/* Timer display */}
                            <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#64748b' }}>Elapsed</Typography>
                                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>
                                        {formatTime(elapsed)}
                                    </Typography>
                                </Box>
                                {estimatedRemaining >= 0 && (
                                    <Box>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>Remaining (est.)</Typography>
                                        <Typography sx={{ color: COLORS.cyan, fontWeight: 700, fontSize: '0.95rem' }}>
                                            ~{formatTime(estimatedRemaining)}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>

                            {taskStatus.current_trial !== undefined && taskStatus.total_trials && (
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Chip
                                        label={`Trial ${taskStatus.current_trial} / ${taskStatus.total_trials}`}
                                        size="small"
                                        sx={{ bgcolor: 'rgba(6, 182, 212, 0.15)', color: COLORS.cyan }}
                                    />
                                    {taskStatus.device && (
                                        <Chip
                                            label={taskStatus.device.toUpperCase()}
                                            size="small"
                                            sx={{
                                                bgcolor: taskStatus.device === 'cuda' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                                color: taskStatus.device === 'cuda' ? COLORS.green : '#94a3b8',
                                            }}
                                        />
                                    )}
                                </Box>
                            )}
                        </Paper>
                    )}

                    {/* Terminal Log */}
                    <Paper sx={{
                        ...glassCard,
                        bgcolor: '#0a0e1a',
                        fontFamily: 'monospace',
                        p: 0,
                        overflow: 'hidden',
                    }}>
                        <Box sx={{ p: 1.5, borderBottom: `1px solid ${COLORS.glassBorder}`, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: isRunning ? COLORS.green : '#475569' }} />
                            <Typography variant="caption" sx={{ color: '#64748b', letterSpacing: 1 }}>TRAINING LOG</Typography>
                        </Box>
                        <Box
                            ref={logRef}
                            sx={{
                                p: 2,
                                maxHeight: 400,
                                minHeight: 200,
                                overflowY: 'auto',
                                '&::-webkit-scrollbar': { width: 4 },
                                '&::-webkit-scrollbar-thumb': { bgcolor: '#334155', borderRadius: 2 },
                            }}
                        >
                            {logs.length === 0 ? (
                                <Typography sx={{ color: '#475569', fontSize: '0.85rem' }}>
                                    Waiting for training to start...
                                </Typography>
                            ) : (
                                logs.map((line, i) => (
                                    <Typography key={i} sx={{
                                        color: line.includes('FAILED') ? COLORS.red :
                                            line.includes('completed') ? COLORS.green :
                                                '#4ade80',
                                        fontSize: '0.8rem',
                                        lineHeight: 1.8,
                                    }}>
                                        {line}
                                    </Typography>
                                ))
                            )}
                        </Box>
                    </Paper>
                </Stack>
            </Box>

            {/* Experiment History */}
            {experiments.length > 0 && (
                <Paper sx={{ ...glassCard, mt: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <HistoryIcon sx={{ color: COLORS.cyan }} />
                        <Typography variant="subtitle2" sx={{ color: COLORS.cyan, fontWeight: 700 }}>
                            EXPERIMENT HISTORY ({experiments.length})
                        </Typography>
                    </Box>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ color: '#64748b', borderColor: COLORS.glassBorder }}>#</TableCell>
                                    <TableCell sx={{ color: '#64748b', borderColor: COLORS.glassBorder }}>Model</TableCell>
                                    <TableCell sx={{ color: '#64748b', borderColor: COLORS.glassBorder }}>Status</TableCell>
                                    <TableCell sx={{ color: '#64748b', borderColor: COLORS.glassBorder }}>Metric</TableCell>
                                    <TableCell sx={{ color: '#64748b', borderColor: COLORS.glassBorder }}>Time</TableCell>
                                    <TableCell sx={{ color: '#64748b', borderColor: COLORS.glassBorder }}>Date</TableCell>
                                    <TableCell sx={{ color: '#64748b', borderColor: COLORS.glassBorder }}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {experiments.map((exp, i) => {
                                    const metric = exp.results?.test_metrics?.accuracy != null
                                        ? `Acc: ${(exp.results.test_metrics.accuracy * 100).toFixed(1)}%`
                                        : exp.results?.test_metrics?.mse != null
                                            ? `MSE: ${exp.results.test_metrics.mse.toFixed(4)}`
                                            : '—';
                                    const time = exp.results?.training_time_seconds
                                        ? formatTime(exp.results.training_time_seconds)
                                        : '—';
                                    const date = exp.started_at
                                        ? new Date(exp.started_at).toLocaleString()
                                        : '—';
                                    return (
                                        <TableRow
                                            key={exp.task_id}
                                            hover
                                            sx={{
                                                cursor: exp.status === 'COMPLETED' ? 'pointer' : 'default',
                                                '&:hover': { bgcolor: 'rgba(6, 182, 212, 0.05)' },
                                            }}
                                            onClick={() => {
                                                if (exp.status === 'COMPLETED') {
                                                    router.push(`/projects/${projectId}/evaluate?task_id=${exp.task_id}`);
                                                }
                                            }}
                                        >
                                            <TableCell sx={{ color: '#94a3b8', borderColor: COLORS.glassBorder }}>{i + 1}</TableCell>
                                            <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder, fontWeight: 600 }}>
                                                {exp.best_config?.model_name?.toUpperCase() || '—'}
                                            </TableCell>
                                            <TableCell sx={{ borderColor: COLORS.glassBorder }}>
                                                <Chip
                                                    label={exp.status}
                                                    size="small"
                                                    sx={{
                                                        height: 22, fontSize: '0.65rem', fontWeight: 600,
                                                        bgcolor: exp.status === 'COMPLETED' ? 'rgba(34, 197, 94, 0.15)' :
                                                            exp.status === 'FAILED' ? 'rgba(239, 68, 68, 0.15)' :
                                                                'rgba(6, 182, 212, 0.15)',
                                                        color: exp.status === 'COMPLETED' ? COLORS.green :
                                                            exp.status === 'FAILED' ? COLORS.red :
                                                                COLORS.cyan,
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder }}>{metric}</TableCell>
                                            <TableCell sx={{ color: '#94a3b8', borderColor: COLORS.glassBorder }}>{time}</TableCell>
                                            <TableCell sx={{ color: '#64748b', borderColor: COLORS.glassBorder, fontSize: '0.8rem' }}>{date}</TableCell>
                                            <TableCell sx={{ borderColor: COLORS.glassBorder }}>
                                                {exp.status === 'COMPLETED' && (
                                                    <Typography variant="caption" sx={{ color: COLORS.cyan }}>View</Typography>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}
        </Container>
    );
}
