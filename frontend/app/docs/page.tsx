// app/docs/page.tsx
'use client';

import { Box, Typography, Container, Paper, Stack, Breadcrumbs, Link as MuiLink, Divider } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import BuildIcon from '@mui/icons-material/Build'; // For Tool/Setup
import ScienceIcon from '@mui/icons-material/Science'; // For Research/Methodology

const COLORS = {
    bg: '#0f172a',
    primary: '#06b6d4', // Cyan
    secondary: '#3b82f6', // Blue
    textSecondary: '#94a3b8',
    glass: 'rgba(30, 41, 59, 0.6)',
    glassBorder: 'rgba(255, 255, 255, 0.08)'
};

const Section = ({ title, icon, children }: any) => (
    <Paper sx={{ mb: 6, p: 4, bgcolor: COLORS.glass, border: `1px solid ${COLORS.glassBorder}`, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Box sx={{ color: COLORS.primary, mr: 2, display: 'flex' }}>{icon}</Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>{title}</Typography>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mb: 3 }} />
        {children}
    </Paper>
);

export default function DocumentationPage() {
    return (
        <Box sx={{ minHeight: '100vh', pt: 4, pb: 10 }}>
            <Container maxWidth="lg">
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb" sx={{ mb: 4, color: COLORS.textSecondary }}>
                    <MuiLink underline="hover" color="inherit" href="/">Home</MuiLink>
                    <Typography color="white" fontWeight={600}>Documentation</Typography>
                </Breadcrumbs>

                <Box sx={{ textAlign: 'center', mb: 8 }}>
                    <Typography variant="h2" sx={{ fontWeight: 800, color: '#fff', mb: 2 }}>
                        Documentation
                    </Typography>
                    <Typography variant="h6" sx={{ color: COLORS.textSecondary, maxWidth: 800, mx: 'auto' }}>
                        Comprehensive guides on LayoutXpert's GNN architecture, API endpoints, and integration workflows for physical design automation.
                    </Typography>
                </Box>

                <Section title="Getting Started" icon={<MenuBookIcon fontSize="large" />}>
                    <Typography paragraph sx={{ color: '#cbd5e1', lineHeight: 1.8 }}>
                        LayoutXpert.AI bridges the gap between EDA physical design and geometric deep learning.
                        To begin, ensure you have your design data formatted in standard <b>LEF/DEF</b> or parsed graph formats (PyTorch Geometric compatible).
                    </Typography>

                    <Typography variant="h6" sx={{ color: '#fff', mt: 3, mb: 1 }}>Prerequisites</Typography>
                    <Box component="ul" sx={{ color: '#cbd5e1', pl: 2, lineHeight: 1.8 }}>
                        <li>Python 3.8+ environment</li>
                        <li>NVIDIA GPU (CUDA 11.3+) for inference acceleration</li>
                        <li>EDA Tools (Cadence Innovus / Synopsys ICC2) output logs for ground truth validation</li>
                    </Box>
                </Section>

                <Section title="GNN Model Architecture" icon={<ArchitectureIcon fontSize="large" />}>
                    <Typography paragraph sx={{ color: '#cbd5e1', lineHeight: 1.8 }}>
                        Our platform utilizes a novel hetero-graph neural network designed specifically for Integrated Circuit (IC) netlists.
                        The architecture consists of three main stages:
                    </Typography>

                    <Stack spacing={3} sx={{ mt: 3 }}>
                        <Box sx={{ p: 2, borderLeft: `4px solid ${COLORS.primary}`, bgcolor: 'rgba(6, 182, 212, 0.05)' }}>
                            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>1. Feature Embedding</Typography>
                            <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                                Raw features (gate size, location x/y, fan-in/out) are projected into a 128-dim latent space using Multi-Layer Perceptrons (MLPs).
                            </Typography>
                        </Box>
                        <Box sx={{ p: 2, borderLeft: `4px solid ${COLORS.secondary}`, bgcolor: 'rgba(59, 130, 246, 0.05)' }}>
                            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>2. Message Passing (MPNN)</Typography>
                            <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                                Information aggregates across cell-net-cell edges. We use GATv2 layers to attend to critical timing paths dynamically.
                            </Typography>
                        </Box>
                        <Box sx={{ p: 2, borderLeft: `4px solid #8b5cf6`, bgcolor: 'rgba(139, 92, 246, 0.05)' }}>
                            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>3. Readout & Prediction</Typography>
                            <Typography variant="body2" sx={{ color: COLORS.textSecondary }}>
                                Global pooling aggregates graph-level stats for speed prediction (Regression), while node-level classifiers output violation probabilities (Binary Classification).
                            </Typography>
                        </Box>
                    </Stack>
                </Section>

                <Section title="Technology Process Support" icon={<ScienceIcon fontSize="large" />}>
                    <Typography paragraph sx={{ color: '#cbd5e1', lineHeight: 1.8 }}>
                        The current version is calibrated for <b>TSMC N2 (2nm)</b> process nodes, accounting for FinFET/NanoSheet device characteristics.
                        Resistance and Capacitance (RC) extraction models are tuned to handle high wire resistance in advanced nodes.
                    </Typography>
                    <Typography variant="subtitle2" sx={{ color: COLORS.primary }}>
                        *Backward compatibility with N5/N7 is available via the 'Legacy Mode' flag.
                    </Typography>
                </Section>

                <Section title="API Reference" icon={<BuildIcon fontSize="large" />}>
                    <Typography paragraph sx={{ color: '#cbd5e1', lineHeight: 1.8 }}>
                        The platform exposes RESTful endpoints for automated pipeline integration.
                    </Typography>
                    <Box sx={{ fontFamily: 'monospace', bgcolor: '#020617', p: 3, borderRadius: 2, border: '1px solid #334155' }}>
                        <Typography sx={{ color: COLORS.secondary }}>POST /api/v1/jobs/submit</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: '0.9rem', mb: 2 }}>Submit a new training or inference job.</Typography>

                        <Typography sx={{ color: '#22c55e' }}>GET /api/v1/datasets/{'{id}'}/explore</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: '0.9rem', mb: 2 }}>Retrieve graph statistics and topology metrics.</Typography>

                        <Typography sx={{ color: '#eab308' }}>GET /api/v1/models/leaderboard</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: '0.9rem' }}>Fetch comparative performance of trained architectures.</Typography>
                    </Box>
                    <Box sx={{ mt: 2 }}>
                        <MuiLink href="/api-spec" sx={{ color: COLORS.primary, fontWeight: 600 }}>View Full Swagger Specification &rarr;</MuiLink>
                    </Box>
                </Section>
            </Container>
        </Box>
    );
}
