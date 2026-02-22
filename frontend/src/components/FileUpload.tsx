// components/FileUpload.tsx
'use client';

import { useState, ChangeEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface FileUploadProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export default function FileUpload({ onUpload, isLoading }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUploadClick = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Button
          component="label"
          variant="outlined"
          startIcon={<AttachFileIcon />}
          sx={{ 
            // 霓虹邊框按鈕風格
            borderColor: 'rgba(0, 242, 255, 0.5)',
            color: '#00f2ff',
            borderWidth: '2px',
            '&:hover': {
                borderColor: '#00f2ff',
                background: 'rgba(0, 242, 255, 0.1)',
                boxShadow: '0 0 15px rgba(0, 242, 255, 0.3)'
            }
          }}
        >
          Select Dataset File
          <input type="file" hidden onChange={handleFileChange} accept=".pt" />
        </Button>
        
        {selectedFile && (
            <Box sx={{ 
                py: 0.5, px: 2, 
                borderRadius: '20px', 
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
            <Typography variant="body2" component="span" sx={{ color: 'text.primary' }}>
                {selectedFile.name}
            </Typography>
          </Box>
        )}
      </Box>

      <Button
        variant="contained"
        onClick={handleUploadClick}
        disabled={!selectedFile || isLoading}
        startIcon={<CloudUploadIcon />}
        sx={{ 
            // 實心霓虹漸層按鈕
            background: 'linear-gradient(45deg, #00f2ff 30%, #7000ff 90%)',
            color: 'black', // 深色背景上黑色文字對比度較高
            fontWeight: 700,
            py: 1.5,
            boxShadow: '0 4px 15px rgba(0, 242, 255, 0.3)',
            '&:hover': {
                boxShadow: '0 6px 20px rgba(0, 242, 255, 0.5)',
            },
            '&.Mui-disabled': {
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.3)'
            }
        }}
      >
        {isLoading ? 'Uploading & Analyzing...' : 'Initialize Upload'}
      </Button>
    </Box>
  );
}