'use client';

import { useState, ChangeEvent } from 'react';
import { Button, Tag, Space } from 'antd';
import { PaperClipOutlined, CloudUploadOutlined } from '@ant-design/icons';

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
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>
        <Button icon={<PaperClipOutlined />} onClick={() => document.getElementById('file-upload-input')?.click()}>
          Select Dataset File
        </Button>
        <input id="file-upload-input" type="file" hidden onChange={handleFileChange} accept=".pt" />
        {selectedFile && <Tag>{selectedFile.name}</Tag>}
      </Space>

      <Button
        type="primary"
        onClick={handleUploadClick}
        disabled={!selectedFile || isLoading}
        icon={<CloudUploadOutlined />}
        size="large"
        block
      >
        {isLoading ? 'Uploading & Analyzing...' : 'Initialize Upload'}
      </Button>
    </Space>
  );
}
