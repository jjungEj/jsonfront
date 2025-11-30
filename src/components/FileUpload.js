import React, { useState } from 'react';
import './FileUpload.css';

const FileUpload = ({ onUploaded }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (['xlsx', 'csv', 'json'].includes(ext)) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('지원하는 파일 형식: .xlsx, .csv, .json');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8080/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('업로드 실패');
      }

      const data = await response.json();
      onUploaded(data);
      setFile(null);
      document.getElementById('file-input').value = '';
    } catch (err) {
      setError('업로드 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload">
      <h2>파일 업로드</h2>
      <div className="upload-area">
        <input
          id="file-input"
          type="file"
          accept=".xlsx,.csv,.json"
          onChange={handleFileChange}
          disabled={uploading}
        />
        {file && (
          <div className="file-info">
            <p>선택된 파일: {file.name}</p>
            <button onClick={handleUpload} disabled={uploading}>
              {uploading ? '업로드 중...' : '업로드'}
            </button>
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
};

export default FileUpload;

