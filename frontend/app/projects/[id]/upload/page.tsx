'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ScienceIcon from '@mui/icons-material/Science';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';

import {
    uploadProjectFolder, loadDemoData, downloadSampleData,
    listDemoDatasets, DemoDatasetInfo,
} from '@/lib/api';

const COLORS = {
    cyan: '#06b6d4',
    teal: '#14b8a6',
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
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

interface GraphInfo {
    name: string;
    hasNodesTrain: boolean;
    hasEdgesTrain: boolean;
    hasNodesTest: boolean;
    hasEdgesTest: boolean;
    fileCount: number;
}

function analyzeFiles(files: File[]): { graphs: GraphInfo[]; isFlat: boolean } {
    const graphFiles: Record<string, Set<string>> = {};
    let isFlat = true;

    for (const file of files) {
        const path = file.webkitRelativePath || file.name;
        const parts = path.replace(/\\/g, '/').split('/');

        if (parts.length >= 3) {
            isFlat = false;
            const graphName = parts[parts.length - 2];
            const fname = parts[parts.length - 1].toLowerCase();
            if (!graphFiles[graphName]) graphFiles[graphName] = new Set();
            graphFiles[graphName].add(fname);
        } else {
            const fname = parts[parts.length - 1].toLowerCase();
            if (!graphFiles['_root']) graphFiles['_root'] = new Set();
            graphFiles['_root'].add(fname);
        }
    }

    const graphs: GraphInfo[] = Object.entries(graphFiles).map(([name, fnames]) => ({
        name: name === '_root' ? 'Root' : name,
        hasNodesTrain: fnames.has('nodes_train.csv') || fnames.has('node_train.csv'),
        hasEdgesTrain: fnames.has('edges_train.csv') || fnames.has('edge_train.csv'),
        hasNodesTest: fnames.has('nodes_test.csv') || fnames.has('node_test.csv'),
        hasEdgesTest: fnames.has('edges_test.csv') || fnames.has('edge_test.csv'),
        fileCount: fnames.size,
    }));

    return { graphs, isFlat };
}

const TAG_COLORS: Record<string, string> = {
    'single-graph': COLORS.cyan,
    'clean': COLORS.green,
    'edge-features': COLORS.yellow,
    'multi-graph': '#8b5cf6',
    'missing-data': COLORS.red,
    'outliers': '#f97316',
};

export default function UploadPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const folderInputRef = useRef<HTMLInputElement>(null);

    const [datasetName, setDatasetName] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [graphInfos, setGraphInfos] = useState<GraphInfo[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loadingDemoId, setLoadingDemoId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [demos, setDemos] = useState<DemoDatasetInfo[]>([]);

    useEffect(() => {
        listDemoDatasets().then(setDemos).catch(console.error);
    }, []);

    const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f =>
            f.name.toLowerCase().endsWith('.csv')
        );
        if (files.length === 0) {
            setError('No CSV files found in selected folder.');
            return;
        }
        setError(null);
        setSelectedFiles(files);
        const { graphs } = analyzeFiles(files);
        setGraphInfos(graphs);
    };

    const validGraphs = graphInfos.filter(g => g.hasNodesTrain && g.hasEdgesTrain);
    const canUpload = validGraphs.length > 0;

    const handleUpload = async () => {
        if (!canUpload) return;
        setUploading(true);
        setError(null);
        try {
            await uploadProjectFolder(projectId, selectedFiles, datasetName);
            router.push(`/projects/${projectId}/explore`);
        } catch (err: any) {
            setError(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleLoadDemo = async (demoId: string) => {
        setLoadingDemoId(demoId);
        setError(null);
        try {
            await loadDemoData(projectId, demoId);
            router.push(`/projects/${projectId}/explore`);
        } catch (err: any) {
            setError(err.message || 'Failed to load demo data');
        } finally {
            setLoadingDemoId(null);
        }
    };

    const isLoading = uploading || loadingDemoId !== null;

    return (
        <Container maxWidth="md" sx={{ py: 5 }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
                    UPLOAD DATA
                </Typography>
                <Typography sx={{ color: '#94a3b8' }}>
                    Select a project folder containing graph data, or load a demo dataset.
                </Typography>
            </Box>

            <Stack spacing={3}>
                {/* Demo Datasets */}
                <Paper sx={{ ...glassCard, border: `1px solid rgba(234, 179, 8, 0.3)` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <ScienceIcon sx={{ color: COLORS.yellow }} />
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                            Demo Datasets
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', ml: 1 }}>
                            One-click load to explore the platform
                        </Typography>
                    </Box>

                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 2,
                    }}>
                        {demos.map((demo) => (
                            <Paper
                                key={demo.id}
                                sx={{
                                    p: 2,
                                    bgcolor: 'rgba(15, 23, 42, 0.6)',
                                    border: `1px solid ${COLORS.glassBorder}`,
                                    borderRadius: 2,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1,
                                    transition: 'all 0.2s',
                                    '&:hover': { borderColor: COLORS.yellow + '40' },
                                }}
                            >
                                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                                    {demo.name}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.8rem', flex: 1 }}>
                                    {demo.description}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {demo.tags.map(tag => (
                                        <Chip
                                            key={tag}
                                            label={tag}
                                            size="small"
                                            sx={{
                                                height: 20, fontSize: '0.6rem',
                                                bgcolor: `${TAG_COLORS[tag] || '#64748b'}20`,
                                                color: TAG_COLORS[tag] || '#64748b',
                                                border: 'none',
                                            }}
                                        />
                                    ))}
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                                    <Typography variant="caption" sx={{ color: '#475569' }}>
                                        {demo.nodes} nodes · {demo.edges} edges
                                    </Typography>
                                    <Button
                                        size="small"
                                        onClick={() => handleLoadDemo(demo.id)}
                                        disabled={isLoading}
                                        startIcon={loadingDemoId === demo.id ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <ScienceIcon />}
                                        sx={{
                                            bgcolor: COLORS.yellow,
                                            color: '#000',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            textTransform: 'none',
                                            px: 2,
                                            '&:hover': { bgcolor: '#ca8a04' },
                                            '&.Mui-disabled': { bgcolor: '#1e293b', color: '#475569' },
                                        }}
                                    >
                                        {loadingDemoId === demo.id ? 'Loading...' : 'Load'}
                                    </Button>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                </Paper>

                <Divider sx={{ borderColor: COLORS.glassBorder }}>
                    <Typography variant="caption" sx={{ color: '#64748b', px: 2 }}>OR UPLOAD YOUR DATA</Typography>
                </Divider>

                {/* Dataset Name */}
                <TextField
                    label="Dataset Name (optional)"
                    value={datasetName}
                    onChange={e => setDatasetName(e.target.value)}
                    placeholder="Auto-detected from folder name"
                    fullWidth
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            color: '#fff',
                            '& fieldset': { borderColor: COLORS.glassBorder },
                            '&:hover fieldset': { borderColor: '#475569' },
                            '&.Mui-focused fieldset': { borderColor: COLORS.cyan },
                        },
                        '& .MuiInputLabel-root': { color: '#64748b' },
                    }}
                />

                {/* Folder Upload */}
                <Paper
                    onClick={() => folderInputRef.current?.click()}
                    sx={{
                        p: 4,
                        textAlign: 'center',
                        bgcolor: selectedFiles.length > 0 ? 'rgba(20, 184, 166, 0.05)' : COLORS.glass,
                        border: `2px dashed ${selectedFiles.length > 0 ? COLORS.teal : COLORS.glassBorder}`,
                        borderRadius: 3,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: COLORS.cyan + '80', bgcolor: 'rgba(6, 182, 212, 0.03)' },
                    }}
                >
                    <input
                        ref={folderInputRef}
                        type="file"
                        // @ts-ignore - webkitdirectory is not in the types
                        webkitdirectory=""
                        directory=""
                        multiple
                        onChange={handleFolderSelect}
                        style={{ display: 'none' }}
                    />
                    {selectedFiles.length > 0 ? (
                        <Box>
                            <CheckCircleIcon sx={{ fontSize: 40, color: COLORS.teal, mb: 1 }} />
                            <Typography sx={{ color: COLORS.teal, fontWeight: 700, mb: 1 }}>
                                {selectedFiles.length} CSV files selected
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                Click to change folder
                            </Typography>
                        </Box>
                    ) : (
                        <Box>
                            <FolderOpenIcon sx={{ fontSize: 48, color: '#475569', mb: 1 }} />
                            <Typography sx={{ color: '#94a3b8', fontWeight: 600, mb: 0.5 }}>
                                Select Project Folder
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', lineHeight: 1.6 }}>
                                Choose a folder with graph subfolders, each containing<br />
                                <code style={{ color: COLORS.cyan }}>nodes_train.csv</code> + <code style={{ color: COLORS.cyan }}>edges_train.csv</code>
                                {' '}(and optionally test files)
                            </Typography>
                        </Box>
                    )}
                </Paper>

                {/* Detected Graphs */}
                {graphInfos.length > 0 && (
                    <Paper sx={glassCard}>
                        <Typography variant="subtitle2" sx={{ color: COLORS.cyan, fontWeight: 700, mb: 2 }}>
                            DETECTED GRAPHS ({validGraphs.length}/{graphInfos.length})
                        </Typography>
                        <Stack spacing={1}>
                            {graphInfos.map((g) => {
                                const valid = g.hasNodesTrain && g.hasEdgesTrain;
                                return (
                                    <Box key={g.name} sx={{
                                        display: 'flex', alignItems: 'center', gap: 1.5,
                                        p: 1.5, borderRadius: 2,
                                        bgcolor: valid ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                                        border: `1px solid ${valid ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                    }}>
                                        {valid ? (
                                            <CheckCircleIcon sx={{ color: COLORS.green, fontSize: 20 }} />
                                        ) : (
                                            <CloudUploadIcon sx={{ color: COLORS.red, fontSize: 20 }} />
                                        )}
                                        <Typography sx={{ color: '#fff', fontWeight: 600, flex: 1, fontSize: '0.9rem' }}>
                                            {g.name}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            <Chip
                                                label="train"
                                                size="small"
                                                sx={{
                                                    height: 22, fontSize: '0.7rem',
                                                    bgcolor: g.hasNodesTrain && g.hasEdgesTrain ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                    color: g.hasNodesTrain && g.hasEdgesTrain ? COLORS.green : COLORS.red,
                                                }}
                                            />
                                            {(g.hasNodesTest || g.hasEdgesTest) && (
                                                <Chip
                                                    label="test"
                                                    size="small"
                                                    sx={{
                                                        height: 22, fontSize: '0.7rem',
                                                        bgcolor: g.hasNodesTest && g.hasEdgesTest ? 'rgba(6, 182, 212, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                        color: g.hasNodesTest && g.hasEdgesTest ? COLORS.cyan : COLORS.red,
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Stack>
                        {validGraphs.length === 0 && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                No valid graphs detected. Each graph folder needs at least <strong>nodes_train.csv</strong> and <strong>edges_train.csv</strong>.
                            </Alert>
                        )}
                    </Paper>
                )}

                {/* Expected Format Info */}
                <Paper sx={{
                    p: 2,
                    bgcolor: 'rgba(6, 182, 212, 0.05)',
                    border: `1px solid ${COLORS.glassBorder}`,
                    borderRadius: 2,
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <DescriptionIcon sx={{ color: COLORS.cyan, mt: 0.5 }} />
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ color: '#94a3b8', mb: 1 }}>
                                Expected folder structure:
                            </Typography>
                            <Box component="pre" sx={{
                                color: '#64748b', fontSize: '0.75rem', m: 0,
                                fontFamily: 'monospace', lineHeight: 1.6,
                            }}>
{`project_folder/
  graph_A/
    nodes_train.csv    (required)
    edges_train.csv    (required)
    nodes_test.csv     (optional)
    edges_test.csv     (optional)
  graph_B/
    ...`}
                            </Box>
                        </Box>
                        <Button
                            component="a"
                            href={downloadSampleData()}
                            download
                            startIcon={<DownloadIcon />}
                            size="small"
                            sx={{ color: COLORS.cyan, borderColor: COLORS.cyan, textTransform: 'none', flexShrink: 0 }}
                            variant="outlined"
                        >
                            Sample CSV
                        </Button>
                    </Box>
                </Paper>

                {error && <Alert severity="error">{error}</Alert>}

                {/* Upload Button */}
                <Button
                    variant="contained"
                    size="large"
                    onClick={handleUpload}
                    disabled={!canUpload || isLoading}
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
                    {uploading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={20} sx={{ color: '#fff' }} />
                            Uploading...
                        </Box>
                    ) : (
                        `Upload ${validGraphs.length > 0 ? `${validGraphs.length} Graph${validGraphs.length > 1 ? 's' : ''}` : ''} & Continue`
                    )}
                </Button>
            </Stack>
        </Container>
    );
}
