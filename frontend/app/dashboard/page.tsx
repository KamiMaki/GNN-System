'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Fade from '@mui/material/Fade';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import Avatar from '@mui/material/Avatar';

import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import MemoryIcon from '@mui/icons-material/Memory';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';

import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { deleteProject, ProjectSummary } from '@/lib/api';

const COLORS = {
    bg: '#020617',
    cyan: '#06b6d4',
    teal: '#14b8a6',
    glass: 'rgba(15, 23, 42, 0.4)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
};

const STEP_LABELS = ['Upload', 'Analysis', 'Training', 'Evaluation'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    created: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
    data_uploaded: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
    data_confirmed: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
    training: { bg: 'rgba(6, 182, 212, 0.15)', text: '#06b6d4' },
    completed: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
    failed: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
};

function getStepPath(project: ProjectSummary): string {
    const step = project.current_step;
    const id = project.project_id;
    if (project.status === 'completed') return `/projects/${id}/evaluate`;
    if (step <= 1 && project.status === 'created') return `/projects/${id}/upload`;
    if (step <= 2) return `/projects/${id}/explore`;
    if (step <= 3) return `/projects/${id}/train`;
    return `/projects/${id}/evaluate`;
}

export default function DashboardPage() {
    const router = useRouter();
    const { projects, loading, createNewProject, refreshProjects } = useProject();
    const { user, logout } = useAuth();
    const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

    const [search, setSearch] = useState('');
    const [tagFilter, setTagFilter] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newTags, setNewTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [creating, setCreating] = useState(false);

    // Collect all unique tags
    const allTags = useMemo(() => {
        const tags = new Set<string>();
        projects.forEach(p => p.tags?.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [projects]);

    // Filter projects
    const filtered = useMemo(() => {
        let result = projects;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.tags?.some(t => t.toLowerCase().includes(q))
            );
        }
        if (tagFilter) {
            result = result.filter(p => p.tags?.includes(tagFilter));
        }
        return result;
    }, [projects, search, tagFilter]);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const project = await createNewProject(newName.trim(), newTags);
            setDialogOpen(false);
            setNewName('');
            setNewTags([]);
            router.push(`/projects/${project.project_id}/upload`);
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const handleTagAdd = () => {
        const tag = tagInput.trim();
        if (tag && !newTags.includes(tag)) {
            setNewTags([...newTags, tag]);
        }
        setTagInput('');
    };

    const handleDelete = async (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        if (!confirm('Delete this project?')) return;
        try {
            await deleteProject(projectId);
            refreshProjects();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: COLORS.bg, color: '#fff' }}>
            {/* Header */}
            <Box sx={{
                py: 2, px: 3,
                background: COLORS.glass,
                backdropFilter: 'blur(20px)',
                borderBottom: `1px solid ${COLORS.glassBorder}`,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
            }}>
                <Button
                    onClick={() => router.push('/dashboard')}
                    startIcon={<MemoryIcon />}
                    sx={{
                        color: '#fff',
                        textTransform: 'none',
                        fontWeight: 800,
                        fontSize: '1rem',
                        letterSpacing: '-0.02em',
                        '&:hover': { bgcolor: 'rgba(6, 182, 212, 0.1)' },
                        '& .MuiButton-startIcon': { color: COLORS.cyan },
                    }}
                >
                    LayoutXpert
                </Button>
                <Typography variant="body2" sx={{ color: '#64748b', ml: 1 }}>
                    PROJECT WORKSPACE
                </Typography>
                <Box sx={{ flex: 1 }} />
                {user && (
                    <>
                        <Button
                            onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                            sx={{ minWidth: 0, p: 0.5, borderRadius: '50%' }}
                        >
                            <Avatar
                                src={user.avatar}
                                alt={user.name}
                                sx={{ width: 32, height: 32, border: `2px solid ${COLORS.glassBorder}` }}
                            />
                        </Button>
                        <Menu
                            anchorEl={userMenuAnchor}
                            open={Boolean(userMenuAnchor)}
                            onClose={() => setUserMenuAnchor(null)}
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
                            <MenuItem onClick={() => setUserMenuAnchor(null)} sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                                <ListItemIcon><PersonIcon sx={{ color: '#64748b', fontSize: 18 }} /></ListItemIcon>
                                Profile
                            </MenuItem>
                            <MenuItem onClick={() => setUserMenuAnchor(null)} sx={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                                <ListItemIcon><SettingsIcon sx={{ color: '#64748b', fontSize: 18 }} /></ListItemIcon>
                                Settings
                            </MenuItem>
                            <Divider sx={{ borderColor: COLORS.glassBorder }} />
                            <MenuItem onClick={() => { setUserMenuAnchor(null); logout(); }} sx={{ color: '#ef4444', fontSize: '0.85rem' }}>
                                <ListItemIcon><LogoutIcon sx={{ color: '#ef4444', fontSize: 18 }} /></ListItemIcon>
                                Logout
                            </MenuItem>
                        </Menu>
                    </>
                )}
            </Box>

            <Container maxWidth="lg" sx={{ py: 4 }}>
                {/* Toolbar */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                    <TextField
                        placeholder="Search projects..."
                        size="small"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: '#64748b' }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            flex: 1, maxWidth: 400,
                            '& .MuiOutlinedInput-root': {
                                color: '#fff',
                                bgcolor: 'rgba(15, 23, 42, 0.6)',
                                '& fieldset': { borderColor: COLORS.glassBorder },
                                '&:hover fieldset': { borderColor: '#475569' },
                                '&.Mui-focused fieldset': { borderColor: COLORS.cyan },
                            },
                        }}
                    />

                    {/* Tag filter chips */}
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1 }}>
                        {tagFilter && (
                            <Chip
                                label={`Tag: ${tagFilter}`}
                                onDelete={() => setTagFilter(null)}
                                size="small"
                                sx={{ bgcolor: 'rgba(6, 182, 212, 0.15)', color: COLORS.cyan }}
                            />
                        )}
                        {allTags.slice(0, 8).map(tag => (
                            <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                variant={tagFilter === tag ? 'filled' : 'outlined'}
                                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                                sx={{
                                    borderColor: COLORS.glassBorder,
                                    color: tagFilter === tag ? COLORS.cyan : '#94a3b8',
                                    bgcolor: tagFilter === tag ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                                    '&:hover': { borderColor: '#475569' },
                                }}
                            />
                        ))}
                    </Box>

                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setDialogOpen(true)}
                        sx={{
                            bgcolor: COLORS.cyan,
                            fontWeight: 700,
                            borderRadius: 2,
                            '&:hover': { bgcolor: COLORS.teal },
                        }}
                    >
                        New Project
                    </Button>
                </Box>

                {/* Project Grid */}
                {loading && projects.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress sx={{ color: COLORS.cyan }} />
                    </Box>
                ) : filtered.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <FolderIcon sx={{ fontSize: 64, color: '#334155', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#64748b' }}>
                            {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#475569', mt: 1 }}>
                            {projects.length === 0 ? 'Create your first project to get started.' : 'Try adjusting your search or filters.'}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
                        gap: 3,
                    }}>
                        {filtered.map((project) => {
                            const sc = STATUS_COLORS[project.status] || STATUS_COLORS.created;
                            return (
                                <Fade in key={project.project_id} timeout={300}>
                                    <Card sx={{
                                        bgcolor: COLORS.glass,
                                        backdropFilter: 'blur(20px)',
                                        border: `1px solid ${COLORS.glassBorder}`,
                                        borderRadius: 3,
                                        transition: 'all 0.3s',
                                        '&:hover': {
                                            borderColor: COLORS.cyan + '40',
                                            transform: 'translateY(-2px)',
                                            boxShadow: `0 8px 30px rgba(6, 182, 212, 0.1)`,
                                        },
                                    }}>
                                        <CardActionArea onClick={() => router.push(getStepPath(project))}>
                                            <CardContent sx={{ p: 3 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }} noWrap>
                                                        {project.name}
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleDelete(e, project.project_id)}
                                                        sx={{ color: '#475569', '&:hover': { color: '#ef4444' } }}
                                                    >
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>

                                                {/* Tags */}
                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2, minHeight: 24 }}>
                                                    {project.tags?.slice(0, 3).map(tag => (
                                                        <Chip key={tag} label={tag} size="small"
                                                            sx={{ fontSize: '0.65rem', height: 20, bgcolor: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', border: 'none' }}
                                                        />
                                                    ))}
                                                </Box>

                                                {/* Status & Date */}
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                    <Chip
                                                        label={project.status.replace('_', ' ').toUpperCase()}
                                                        size="small"
                                                        sx={{ fontSize: '0.65rem', height: 22, bgcolor: sc.bg, color: sc.text, fontWeight: 600 }}
                                                    />
                                                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                        {new Date(project.created_at).toLocaleDateString()}
                                                    </Typography>
                                                </Box>

                                                {/* Step progress */}
                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                    {STEP_LABELS.map((label, i) => (
                                                        <Box key={label} sx={{ flex: 1, textAlign: 'center' }}>
                                                            <Box sx={{
                                                                height: 3, borderRadius: 1, mb: 0.5,
                                                                bgcolor: i < project.current_step
                                                                    ? (project.status === 'completed' ? COLORS.teal : COLORS.cyan)
                                                                    : '#1e293b',
                                                            }} />
                                                            <Typography variant="caption"
                                                                sx={{ fontSize: '0.55rem', color: i < project.current_step ? '#94a3b8' : '#334155' }}>
                                                                {label}
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </CardContent>
                                        </CardActionArea>
                                    </Card>
                                </Fade>
                            );
                        })}
                    </Box>
                )}
            </Container>

            {/* Create Project Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
                PaperProps={{ sx: { bgcolor: '#0f172a', border: `1px solid ${COLORS.glassBorder}`, borderRadius: 3, color: '#fff' } }}>
                <DialogTitle sx={{ fontWeight: 700, color: COLORS.cyan }}>Create New Project</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField label="Project Name" fullWidth value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                            sx={{ '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: COLORS.glassBorder }, '&:hover fieldset': { borderColor: '#475569' }, '&.Mui-focused fieldset': { borderColor: COLORS.cyan } }, '& .MuiInputLabel-root': { color: '#64748b' } }} />
                        <Box>
                            <TextField label="Add Tags" size="small" value={tagInput} onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleTagAdd(); } }}
                                placeholder="Press Enter to add" fullWidth
                                sx={{ '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: COLORS.glassBorder }, '&:hover fieldset': { borderColor: '#475569' }, '&.Mui-focused fieldset': { borderColor: COLORS.cyan } }, '& .MuiInputLabel-root': { color: '#64748b' } }} />
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                                {newTags.map(tag => (
                                    <Chip key={tag} label={tag} size="small" onDelete={() => setNewTags(newTags.filter(t => t !== tag))}
                                        sx={{ bgcolor: 'rgba(6, 182, 212, 0.15)', color: COLORS.cyan }} />
                                ))}
                            </Box>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={() => setDialogOpen(false)} sx={{ color: '#94a3b8' }}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreate} disabled={!newName.trim() || creating}
                        sx={{ bgcolor: COLORS.cyan, fontWeight: 700, '&:hover': { bgcolor: COLORS.teal } }}>
                        {creating ? <CircularProgress size={20} /> : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
