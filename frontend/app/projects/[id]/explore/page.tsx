'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ScatterChart, Scatter, Cell, Legend,
} from 'recharts';

import {
    getProjectExplore, analyzeColumn, getCorrelation, validateLabel, imputeMissing, confirmData,
    GenericExploreData, ColumnInfo, ColumnStats, NumericColumnStats, CategoricalColumnStats,
    LabelValidationResult,
} from '@/lib/api';

const COLORS = {
    cyan: '#06b6d4',
    teal: '#14b8a6',
    blue: '#3b82f6',
    violet: '#8b5cf6',
    red: '#ef4444',
    green: '#22c55e',
    glass: 'rgba(15, 23, 42, 0.4)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
};

const TASK_TYPES = [
    { value: 'node_classification', label: 'Node Classification' },
    { value: 'node_regression', label: 'Node Regression' },
    { value: 'graph_classification', label: 'Graph Classification' },
    { value: 'graph_regression', label: 'Graph Regression' },
];

const glassCard = {
    bgcolor: COLORS.glass,
    backdropFilter: 'blur(20px)',
    border: `1px solid ${COLORS.glassBorder}`,
    borderRadius: 3,
    p: 3,
};

const textFieldSx = {
    '& .MuiOutlinedInput-root': {
        color: '#fff',
        '& fieldset': { borderColor: COLORS.glassBorder },
        '&:hover fieldset': { borderColor: '#475569' },
        '&.Mui-focused fieldset': { borderColor: COLORS.cyan },
    },
    '& .MuiInputLabel-root': { color: '#64748b' },
    '& .MuiSvgIcon-root': { color: '#64748b' },
};

export default function ExplorePage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // Data
    const [exploreData, setExploreData] = useState<GenericExploreData | null>(null);
    const [loading, setLoading] = useState(true);

    // Correlation
    const [corrColumns, setCorrColumns] = useState<string[]>([]);
    const [corrData, setCorrData] = useState<Array<{ x: string; y: string; value: number }>>([]);

    // Column analysis
    const [selectedColumn, setSelectedColumn] = useState('');
    const [columnTypeOverride, setColumnTypeOverride] = useState<string | null>(null);
    const [columnStats, setColumnStats] = useState<ColumnStats | null>(null);
    const [columnLoading, setColumnLoading] = useState(false);

    // Missing value handling
    const [imputeMethod, setImputeMethod] = useState<string>('mean');
    const [imputeLoading, setImputeLoading] = useState(false);
    const [imputeResult, setImputeResult] = useState<string | null>(null);

    // Label & Task
    const [taskType, setTaskType] = useState('');
    const [labelColumn, setLabelColumn] = useState('');
    const [labelValidation, setLabelValidation] = useState<LabelValidationResult | null>(null);
    const [labelLoading, setLabelLoading] = useState(false);

    // Confirm
    const [confirming, setConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);

    // Load explore data
    useEffect(() => {
        if (!projectId) return;
        setLoading(true);
        getProjectExplore(projectId)
            .then(data => {
                setExploreData(data);
                setCorrColumns(data.correlation_columns);
                setCorrData(data.feature_correlation);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [projectId]);

    // Update correlation when columns change
    const handleCorrToggle = useCallback(async (col: string) => {
        const newCols = corrColumns.includes(col)
            ? corrColumns.filter(c => c !== col)
            : [...corrColumns, col];
        setCorrColumns(newCols);
        if (newCols.length >= 2) {
            try {
                const data = await getCorrelation(projectId, newCols);
                setCorrData(data);
            } catch (err) {
                console.error(err);
            }
        }
    }, [corrColumns, projectId]);

    // Analyze column
    useEffect(() => {
        if (!selectedColumn || !projectId) return;
        setColumnLoading(true);
        setColumnStats(null);
        setImputeResult(null);
        analyzeColumn(projectId, selectedColumn, columnTypeOverride || undefined)
            .then(setColumnStats)
            .catch(console.error)
            .finally(() => setColumnLoading(false));
    }, [selectedColumn, columnTypeOverride, projectId]);

    // Validate label
    useEffect(() => {
        if (!taskType || !labelColumn || !projectId) {
            setLabelValidation(null);
            return;
        }
        setLabelLoading(true);
        validateLabel(projectId, taskType, labelColumn)
            .then(setLabelValidation)
            .catch(console.error)
            .finally(() => setLabelLoading(false));
    }, [taskType, labelColumn, projectId]);

    // Impute missing values
    const handleImpute = async () => {
        if (!selectedColumn) return;
        setImputeLoading(true);
        try {
            const result = await imputeMissing(projectId, selectedColumn, imputeMethod);
            setImputeResult(`Filled ${result.filled_count} values using ${result.method}`);
            // Refresh explore data
            const data = await getProjectExplore(projectId);
            setExploreData(data);
            // Re-analyze column
            const stats = await analyzeColumn(projectId, selectedColumn, columnTypeOverride || undefined);
            setColumnStats(stats);
        } catch (err: any) {
            setImputeResult(`Error: ${err.message}`);
        } finally {
            setImputeLoading(false);
        }
    };

    // Confirm and proceed
    const handleConfirm = async () => {
        if (!taskType || !labelColumn) return;
        setConfirming(true);
        setConfirmError(null);
        try {
            await confirmData(projectId, taskType, labelColumn);
            router.push(`/projects/${projectId}/train`);
        } catch (err: any) {
            setConfirmError(err.message || 'Confirmation failed');
        } finally {
            setConfirming(false);
        }
    };

    if (loading || !exploreData) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress sx={{ color: COLORS.cyan }} />
            </Box>
        );
    }

    const numericColumns = exploreData.columns.filter(c => c.dtype === 'numeric');
    const allColumnNames = exploreData.columns.map(c => c.name);
    const missingColumns = exploreData.columns.filter(c => c.missing_count > 0);
    const currentColInfo = exploreData.columns.find(c => c.name === selectedColumn);

    const canConfirm = taskType && labelColumn && labelValidation?.valid && !confirming;

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800 }}>
                        DATA ANALYSIS
                    </Typography>
                    <Typography sx={{ color: '#94a3b8' }}>
                        Explore your data, handle missing values, and configure the learning task.
                    </Typography>
                </Box>
                <Chip
                    icon={<CheckCircleIcon />}
                    label={`${exploreData.num_nodes.toLocaleString()} nodes / ${exploreData.num_edges.toLocaleString()} edges`}
                    sx={{ bgcolor: 'rgba(6, 182, 212, 0.15)', color: COLORS.cyan, fontWeight: 600, fontSize: '0.85rem', height: 36 }}
                />
            </Box>

            <Stack spacing={4}>
                {/* ── SECTION I: GRAPH TOPOLOGY ── */}
                <Paper sx={glassCard}>
                    <Typography variant="overline" sx={{ color: COLORS.cyan, letterSpacing: 2, fontWeight: 700 }}>
                        I. GRAPH TOPOLOGY
                    </Typography>

                    {/* Node/Edge counts */}
                    <Box sx={{ display: 'flex', gap: 3, my: 2 }}>
                        <Paper sx={{ ...glassCard, flex: 1, textAlign: 'center' }}>
                            <Typography variant="h3" sx={{ color: COLORS.cyan, fontWeight: 800 }}>
                                {exploreData.num_nodes.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#94a3b8', letterSpacing: 1 }}>NODES</Typography>
                        </Paper>
                        <Paper sx={{ ...glassCard, flex: 1, textAlign: 'center' }}>
                            <Typography variant="h3" sx={{ color: COLORS.teal, fontWeight: 800 }}>
                                {exploreData.num_edges.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#94a3b8', letterSpacing: 1 }}>EDGES</Typography>
                        </Paper>
                    </Box>

                    {/* Feature Correlation */}
                    <Typography variant="subtitle2" sx={{ color: '#fff', mt: 3, mb: 1, fontWeight: 700 }}>
                        Feature Correlation
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                        {numericColumns.map(col => (
                            <FormControlLabel
                                key={col.name}
                                control={
                                    <Checkbox
                                        checked={corrColumns.includes(col.name)}
                                        onChange={() => handleCorrToggle(col.name)}
                                        size="small"
                                        sx={{ color: '#475569', '&.Mui-checked': { color: COLORS.cyan } }}
                                    />
                                }
                                label={<Typography variant="caption" sx={{ color: '#94a3b8' }}>{col.name}</Typography>}
                            />
                        ))}
                    </Box>

                    {corrData.length > 0 && corrColumns.length >= 2 && (
                        <Box sx={{ overflowX: 'auto' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: `80px repeat(${corrColumns.length}, 1fr)`, gap: 0.5 }}>
                                {/* Header row */}
                                <Box />
                                {corrColumns.map(col => (
                                    <Box key={col} sx={{ textAlign: 'center', p: 0.5 }}>
                                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.65rem' }}>{col}</Typography>
                                    </Box>
                                ))}
                                {/* Data rows */}
                                {corrColumns.map(row => (
                                    <React.Fragment key={row}>
                                        <Box sx={{ p: 0.5, display: 'flex', alignItems: 'center' }}>
                                            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.65rem' }}>{row}</Typography>
                                        </Box>
                                        {corrColumns.map(col => {
                                            const cell = corrData.find(d => d.x === row && d.y === col);
                                            const val = cell?.value || 0;
                                            const intensity = Math.abs(val);
                                            const bgColor = val > 0
                                                ? `rgba(6, 182, 212, ${intensity * 0.6})`
                                                : `rgba(239, 68, 68, ${intensity * 0.6})`;
                                            return (
                                                <Box key={`${row}-${col}`} sx={{
                                                    bgcolor: bgColor,
                                                    borderRadius: 1,
                                                    p: 0.5,
                                                    textAlign: 'center',
                                                    minHeight: 32,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 600 }}>
                                                        {val.toFixed(2)}
                                                    </Typography>
                                                </Box>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </Box>
                        </Box>
                    )}
                </Paper>

                {/* ── SECTION II: NODE ANALYSIS ── */}
                <Paper sx={glassCard}>
                    <Typography variant="overline" sx={{ color: COLORS.cyan, letterSpacing: 2, fontWeight: 700 }}>
                        II. NODE ANALYSIS
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'flex-start' }}>
                        <FormControl sx={{ minWidth: 250, ...textFieldSx }}>
                            <InputLabel>Select Column</InputLabel>
                            <Select
                                value={selectedColumn}
                                onChange={e => { setSelectedColumn(e.target.value); setColumnTypeOverride(null); }}
                                label="Select Column"
                            >
                                {allColumnNames.map(name => {
                                    const info = exploreData.columns.find(c => c.name === name);
                                    const isHighCard = info && info.dtype === 'categorical' && info.unique_count > 50;
                                    const isIdLike = info && info.dtype === 'numeric' && info.unique_count === exploreData.num_nodes;
                                    return (
                                        <MenuItem key={name} value={name}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                                {name}
                                                {info && (
                                                    <Chip label={info.dtype} size="small"
                                                        sx={{
                                                            ml: 'auto', fontSize: '0.6rem', height: 18,
                                                            bgcolor: info.dtype === 'numeric' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                                                            color: info.dtype === 'numeric' ? COLORS.cyan : COLORS.violet,
                                                        }} />
                                                )}
                                                {isHighCard && (
                                                    <Chip label="high cardinality" size="small"
                                                        sx={{ fontSize: '0.55rem', height: 18, bgcolor: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }} />
                                                )}
                                                {isIdLike && (
                                                    <Chip label="ID-like" size="small"
                                                        sx={{ fontSize: '0.55rem', height: 18, bgcolor: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }} />
                                                )}
                                                {info && info.missing_count > 0 && (
                                                    <Chip label={`${info.missing_count} missing`} size="small"
                                                        sx={{ fontSize: '0.6rem', height: 18, bgcolor: 'rgba(239, 68, 68, 0.15)', color: COLORS.red }} />
                                                )}
                                            </Box>
                                        </MenuItem>
                                    );
                                })}
                            </Select>
                        </FormControl>

                        {selectedColumn && currentColInfo && (
                            <ToggleButtonGroup
                                exclusive
                                value={columnTypeOverride || currentColInfo.dtype}
                                onChange={(_, val) => { if (val) setColumnTypeOverride(val); }}
                                size="small"
                                sx={{
                                    '& .MuiToggleButton-root': {
                                        color: '#64748b', borderColor: COLORS.glassBorder, textTransform: 'none',
                                        '&.Mui-selected': { color: COLORS.cyan, bgcolor: 'rgba(6, 182, 212, 0.15)', borderColor: COLORS.cyan },
                                    },
                                }}
                            >
                                <ToggleButton value="numeric">Numeric</ToggleButton>
                                <ToggleButton value="categorical">Categorical</ToggleButton>
                            </ToggleButtonGroup>
                        )}
                    </Box>

                    {/* Column Stats */}
                    {columnLoading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress size={24} sx={{ color: COLORS.cyan }} />
                        </Box>
                    )}

                    {columnStats && columnStats.dtype === 'numeric' && (() => {
                        const isIdLike = currentColInfo && currentColInfo.unique_count === exploreData.num_nodes;
                        return (
                            <Box sx={{ mt: 3 }}>
                                {isIdLike ? (
                                    <Alert severity="info" sx={{ bgcolor: 'rgba(59, 130, 246, 0.08)', color: COLORS.blue, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                        Column &quot;{selectedColumn}&quot; appears to be an ID column (all {currentColInfo?.unique_count} values are unique). Chart skipped.
                                    </Alert>
                                ) : (
                                    <>
                                        {/* Stats chips */}
                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                                            {[
                                                { label: 'Mean', value: (columnStats as NumericColumnStats).mean },
                                                { label: 'Median', value: (columnStats as NumericColumnStats).median },
                                                { label: 'Std', value: (columnStats as NumericColumnStats).std },
                                                { label: 'Min', value: (columnStats as NumericColumnStats).min },
                                                { label: 'Max', value: (columnStats as NumericColumnStats).max },
                                                { label: 'Q1', value: (columnStats as NumericColumnStats).q1 },
                                                { label: 'Q3', value: (columnStats as NumericColumnStats).q3 },
                                            ].map(s => (
                                                <Chip key={s.label} label={`${s.label}: ${s.value.toFixed(4)}`} size="small"
                                                    sx={{ bgcolor: 'rgba(15, 23, 42, 0.6)', color: '#94a3b8', fontSize: '0.7rem' }} />
                                            ))}
                                            {(columnStats as NumericColumnStats).outlier_count > 0 && (
                                                <Chip
                                                    icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
                                                    label={`${(columnStats as NumericColumnStats).outlier_count} outliers`}
                                                    size="small"
                                                    sx={{ bgcolor: 'rgba(239, 68, 68, 0.15)', color: COLORS.red, fontSize: '0.7rem' }}
                                                />
                                            )}
                                        </Box>

                                        {/* Distribution chart */}
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={(columnStats as NumericColumnStats).distribution}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                                <XAxis dataKey="range" tick={{ fill: '#64748b', fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: `1px solid ${COLORS.glassBorder}`, color: '#fff' }} />
                                                <Bar dataKey="count" fill={COLORS.cyan} radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </>
                                )}
                            </Box>
                        );
                    })()}

                    {columnStats && columnStats.dtype === 'categorical' && (() => {
                        const HIGH_CARDINALITY_THRESHOLD = 50;
                        const isHighCardinality = currentColInfo && currentColInfo.unique_count > HIGH_CARDINALITY_THRESHOLD;
                        return (
                            <Box sx={{ mt: 3 }}>
                                <Chip label={`Top: ${(columnStats as CategoricalColumnStats).top_value} (${(columnStats as CategoricalColumnStats).top_count})`}
                                    size="small" sx={{ bgcolor: 'rgba(139, 92, 246, 0.15)', color: COLORS.violet, mb: 2 }} />
                                {isHighCardinality ? (
                                    <Alert severity="warning" sx={{ mt: 1, bgcolor: 'rgba(234, 179, 8, 0.08)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                                        Column &quot;{selectedColumn}&quot; has {currentColInfo?.unique_count} unique values.
                                        Chart rendering skipped for high-cardinality columns (&gt;{HIGH_CARDINALITY_THRESHOLD} unique values).
                                    </Alert>
                                ) : (
                                    <ResponsiveContainer width="100%" height={Math.max(200, (columnStats as CategoricalColumnStats).value_counts.length * 35)}>
                                        <BarChart data={(columnStats as CategoricalColumnStats).value_counts} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={120} />
                                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: `1px solid ${COLORS.glassBorder}`, color: '#fff' }} />
                                            <Bar dataKey="count" fill={COLORS.violet} radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </Box>
                        );
                    })()}

                    {/* Missing value imputation */}
                    {currentColInfo && currentColInfo.missing_count > 0 && (
                        <Alert
                            severity="warning"
                            sx={{
                                mt: 2,
                                bgcolor: 'rgba(239, 68, 68, 0.08)',
                                color: '#fbbf24',
                                border: '1px solid rgba(251, 191, 36, 0.2)',
                                '& .MuiAlert-icon': { color: '#fbbf24' },
                            }}
                            action={
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <Select
                                        value={imputeMethod}
                                        onChange={e => setImputeMethod(e.target.value)}
                                        size="small"
                                        sx={{
                                            color: '#fff', minWidth: 100,
                                            '& fieldset': { borderColor: 'rgba(251, 191, 36, 0.3)' },
                                            '& .MuiSvgIcon-root': { color: '#fbbf24' },
                                        }}
                                    >
                                        <MenuItem value="mean">Mean</MenuItem>
                                        <MenuItem value="median">Median</MenuItem>
                                        <MenuItem value="zero">Zero</MenuItem>
                                    </Select>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={handleImpute}
                                        disabled={imputeLoading}
                                        sx={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)', textTransform: 'none' }}
                                    >
                                        {imputeLoading ? <CircularProgress size={16} /> : 'Fill'}
                                    </Button>
                                </Box>
                            }
                        >
                            Column &quot;{selectedColumn}&quot; has {currentColInfo.missing_count} missing values ({currentColInfo.missing_pct}%).
                        </Alert>
                    )}
                    {imputeResult && (
                        <Alert severity="success" sx={{ mt: 1, bgcolor: 'rgba(34, 197, 94, 0.08)', color: COLORS.green, border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                            {imputeResult}
                        </Alert>
                    )}
                </Paper>

                {/* ── SECTION III: LABEL & TARGET ANALYSIS ── */}
                <Paper sx={glassCard}>
                    <Typography variant="overline" sx={{ color: COLORS.cyan, letterSpacing: 2, fontWeight: 700 }}>
                        III. LABEL & TARGET ANALYSIS
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 3, mt: 2, flexWrap: 'wrap' }}>
                        {/* Task type selector */}
                        <FormControl sx={{ minWidth: 250, ...textFieldSx }}>
                            <InputLabel>Task Type</InputLabel>
                            <Select
                                value={taskType}
                                onChange={e => setTaskType(e.target.value)}
                                label="Task Type"
                            >
                                {TASK_TYPES.map(t => (
                                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Label column selector */}
                        <Autocomplete
                            options={allColumnNames}
                            value={labelColumn || null}
                            onChange={(_, val) => setLabelColumn(val || '')}
                            renderInput={(params) => (
                                <TextField {...params} label="Label Column" sx={textFieldSx} />
                            )}
                            sx={{ minWidth: 250 }}
                        />
                    </Box>

                    {/* Validation result */}
                    {labelLoading && (
                        <Box sx={{ mt: 2 }}>
                            <CircularProgress size={20} sx={{ color: COLORS.cyan }} />
                        </Box>
                    )}

                    {labelValidation && (
                        <Box sx={{ mt: 2 }}>
                            <Alert
                                severity={labelValidation.valid ? 'success' : 'error'}
                                sx={{
                                    bgcolor: labelValidation.valid ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                    color: labelValidation.valid ? COLORS.green : COLORS.red,
                                    border: `1px solid ${labelValidation.valid ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                }}
                            >
                                {labelValidation.message}
                            </Alert>

                            {/* Classification: show class distribution */}
                            {labelValidation.valid && labelValidation.class_distribution && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="caption" sx={{ color: '#94a3b8', mb: 1, display: 'block' }}>
                                        Class Distribution ({labelValidation.num_classes} classes)
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={labelValidation.class_distribution}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: `1px solid ${COLORS.glassBorder}`, color: '#fff' }} />
                                            <Bar dataKey="count" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            )}

                            {/* Regression: show range stats */}
                            {labelValidation.valid && labelValidation.value_range && (
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                                    {[
                                        { label: 'Min', value: labelValidation.value_range.min },
                                        { label: 'Max', value: labelValidation.value_range.max },
                                        { label: 'Mean', value: labelValidation.value_range.mean },
                                        { label: 'Std', value: labelValidation.value_range.std },
                                    ].map(s => (
                                        <Chip key={s.label} label={`${s.label}: ${s.value.toFixed(4)}`} size="small"
                                            sx={{ bgcolor: 'rgba(20, 184, 166, 0.15)', color: COLORS.teal }} />
                                    ))}
                                    <Chip
                                        label={labelValidation.is_continuous ? 'Continuous' : 'Discrete'}
                                        size="small"
                                        sx={{ bgcolor: 'rgba(59, 130, 246, 0.15)', color: COLORS.blue }}
                                    />
                                </Box>
                            )}
                        </Box>
                    )}
                </Paper>

                {/* ── Missing values summary ── */}
                {missingColumns.length > 0 && (
                    <Alert severity="info" sx={{ bgcolor: 'rgba(59, 130, 246, 0.08)', color: COLORS.blue, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        {missingColumns.length} column(s) have missing values: {missingColumns.map(c => `${c.name} (${c.missing_count})`).join(', ')}.
                        Select each column above to impute.
                    </Alert>
                )}

                {/* ── SECTION IV: ATTRIBUTE SUMMARY ── */}
                <Paper sx={glassCard}>
                    <Typography variant="overline" sx={{ color: COLORS.cyan, letterSpacing: 2, fontWeight: 700, mb: 2, display: 'block' }}>
                        IV. ATTRIBUTE SUMMARY
                    </Typography>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    {['Column Name', 'Type', 'Role', 'Missing', 'Missing %', 'Unique'].map(h => (
                                        <TableCell key={h} sx={{ color: '#94a3b8', borderColor: COLORS.glassBorder, fontWeight: 700, fontSize: '0.75rem' }}>
                                            {h}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {exploreData.columns.map((col) => {
                                    const role = col.name === labelColumn ? 'label'
                                        : col.name.toLowerCase() === 'node_id' ? 'id'
                                        : 'feature';
                                    return (
                                        <TableRow key={`node-${col.name}`} sx={{
                                            '&:hover': { bgcolor: 'rgba(6, 182, 212, 0.05)' },
                                            opacity: role === 'id' ? 0.5 : 1,
                                        }}>
                                            <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder, fontWeight: 600, fontSize: '0.8rem' }}>
                                                {col.name}
                                            </TableCell>
                                            <TableCell sx={{ borderColor: COLORS.glassBorder }}>
                                                <Chip label={col.dtype} size="small" sx={{
                                                    height: 20, fontSize: '0.6rem',
                                                    bgcolor: col.dtype === 'numeric' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                                                    color: col.dtype === 'numeric' ? COLORS.cyan : COLORS.violet,
                                                }} />
                                            </TableCell>
                                            <TableCell sx={{ borderColor: COLORS.glassBorder }}>
                                                <Chip label={role} size="small" sx={{
                                                    height: 20, fontSize: '0.6rem',
                                                    bgcolor: role === 'label' ? 'rgba(234, 179, 8, 0.15)' :
                                                        role === 'id' ? 'rgba(148, 163, 184, 0.15)' :
                                                        'rgba(34, 197, 94, 0.15)',
                                                    color: role === 'label' ? '#eab308' :
                                                        role === 'id' ? '#94a3b8' :
                                                        COLORS.green,
                                                }} />
                                            </TableCell>
                                            <TableCell sx={{
                                                color: col.missing_count > 0 ? COLORS.red : '#64748b',
                                                borderColor: COLORS.glassBorder,
                                                fontWeight: col.missing_count > 0 ? 600 : 400,
                                            }}>
                                                {col.missing_count}
                                            </TableCell>
                                            <TableCell sx={{
                                                color: col.missing_pct > 0 ? COLORS.red : '#64748b',
                                                borderColor: COLORS.glassBorder,
                                            }}>
                                                {col.missing_pct.toFixed(1)}%
                                            </TableCell>
                                            <TableCell sx={{ color: '#94a3b8', borderColor: COLORS.glassBorder }}>
                                                {col.unique_count}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {/* Edge columns */}
                                {exploreData.edge_columns && exploreData.edge_columns.length > 0 && (
                                    <>
                                        <TableRow>
                                            <TableCell colSpan={6} sx={{
                                                color: COLORS.teal, borderColor: COLORS.glassBorder,
                                                fontWeight: 700, fontSize: '0.7rem', letterSpacing: 1, pt: 2,
                                            }}>
                                                EDGE ATTRIBUTES
                                            </TableCell>
                                        </TableRow>
                                        {exploreData.edge_columns.map((col) => (
                                            <TableRow key={`edge-${col.name}`} sx={{
                                                '&:hover': { bgcolor: 'rgba(6, 182, 212, 0.05)' },
                                            }}>
                                                <TableCell sx={{ color: '#fff', borderColor: COLORS.glassBorder, fontWeight: 600, fontSize: '0.8rem' }}>
                                                    {col.name}
                                                </TableCell>
                                                <TableCell sx={{ borderColor: COLORS.glassBorder }}>
                                                    <Chip label={col.dtype} size="small" sx={{
                                                        height: 20, fontSize: '0.6rem',
                                                        bgcolor: col.dtype === 'numeric' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                                                        color: col.dtype === 'numeric' ? COLORS.cyan : COLORS.violet,
                                                    }} />
                                                </TableCell>
                                                <TableCell sx={{ borderColor: COLORS.glassBorder }}>
                                                    <Chip label="edge_attr" size="small" sx={{
                                                        height: 20, fontSize: '0.6rem',
                                                        bgcolor: 'rgba(20, 184, 166, 0.15)',
                                                        color: COLORS.teal,
                                                    }} />
                                                </TableCell>
                                                <TableCell sx={{
                                                    color: col.missing_count > 0 ? COLORS.red : '#64748b',
                                                    borderColor: COLORS.glassBorder,
                                                    fontWeight: col.missing_count > 0 ? 600 : 400,
                                                }}>
                                                    {col.missing_count}
                                                </TableCell>
                                                <TableCell sx={{
                                                    color: col.missing_pct > 0 ? COLORS.red : '#64748b',
                                                    borderColor: COLORS.glassBorder,
                                                }}>
                                                    {col.missing_pct.toFixed(1)}%
                                                </TableCell>
                                                <TableCell sx={{ color: '#94a3b8', borderColor: COLORS.glassBorder }}>
                                                    {col.unique_count}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                {/* ── Confirm & Proceed ── */}
                {confirmError && <Alert severity="error">{confirmError}</Alert>}

                {!taskType && (
                    <Alert severity="info" sx={{ bgcolor: 'rgba(6, 182, 212, 0.08)', color: COLORS.cyan, border: `1px solid rgba(6, 182, 212, 0.2)` }}>
                        Please select a task type and label column to proceed.
                    </Alert>
                )}

                <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardIcon />}
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    sx={{
                        py: 1.5,
                        fontWeight: 700,
                        fontSize: '1rem',
                        bgcolor: COLORS.cyan,
                        borderRadius: 2,
                        '&:hover': { bgcolor: COLORS.teal },
                        '&.Mui-disabled': { bgcolor: '#1e293b', color: '#475569' },
                    }}
                >
                    {confirming ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={20} sx={{ color: '#fff' }} />
                            Confirming...
                        </Box>
                    ) : (
                        'Confirm & Proceed to Training'
                    )}
                </Button>
            </Stack>
        </Container>
    );
}
