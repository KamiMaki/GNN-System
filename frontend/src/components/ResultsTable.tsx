// components/ResultsTable.tsx
'use client';

import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import SpeedIcon from '@mui/icons-material/Speed';

interface Results {
    accuracy: number;
    training_time_seconds: number;
}

interface ResultsTableProps {
    results: Results;
}

export default function ResultsTable({ results }: ResultsTableProps) {
    return (
        <Box sx={{ mt: 6, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                 <SpeedIcon sx={{ color: '#00f2ff', mr: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Evaluation Metrics
                </Typography>
            </Box>
           
            <TableContainer component={Paper} sx={{ background: 'rgba(255,255,255,0.02) !important' }}>
                <Table sx={{ minWidth: 650 }} aria-label="simple table">
                    <TableHead>
                        <TableRow sx={{ 'th': { borderBottom: '1px solid rgba(0, 242, 255, 0.2)', color: '#94a3b8' } }}>
                            <TableCell>Metric</TableCell>
                            <TableCell align="right">Value</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 }, 'td, th': { borderBottom: '1px solid rgba(255,255,255,0.05)' } }}>
                            <TableCell component="th" scope="row" sx={{ fontWeight: 500 }}>
                                Model Accuracy
                            </TableCell>
                            <TableCell align="right">
                                <Typography component="span" sx={{ color: '#00f2ff', fontWeight: 700, textShadow: '0 0 8px rgba(0, 242, 255, 0.3)' }}>
                                    {(results.accuracy * 100).toFixed(2)}%
                                </Typography>
                            </TableCell>
                        </TableRow>
                        <TableRow sx={{ 'td, th': { borderBottom: 'none' } }}>
                            <TableCell component="th" scope="row" sx={{ fontWeight: 500 }}>
                                Training Duration
                            </TableCell>
                            <TableCell align="right" sx={{ color: '#f8fafc' }}>
                                {results.training_time_seconds.toFixed(2)}s
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}