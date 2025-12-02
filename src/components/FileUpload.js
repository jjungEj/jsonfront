import React, { useCallback, useMemo, useRef, useState } from 'react';
import './FileUpload.css';

const ACCEPTED_EXTENSIONS = ['xlsx', 'csv', 'json'];

const FileUpload = ({
  onUploaded,
  variant = 'card',
  triggerLabel = '파일 선택',
}) => {
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState([]);
  const inputRef = useRef(null);
  const inputId = useMemo(
    () => `file-input-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  const updateStatus = useCallback((id, patch) => {
    setUploadStatuses((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  const uploadSingleFile = useCallback(
    async (file) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8080/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || '업로드 실패');
      }

      const data = await response.json();
      onUploaded(data);
    },
    [onUploaded]
  );

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);

    const validFiles = [];
    const invalidFiles = [];

    files.forEach((file) => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (ACCEPTED_EXTENSIONS.includes(ext)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      setError(`지원하는 파일 형식(.xlsx, .csv, .json)이 아닙니다: ${invalidFiles.join(', ')}`);
    } else {
      setError(null);
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    const stampedFiles = validFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file,
    }));

    setUploadStatuses((prev) => [
      ...stampedFiles.map(({ id, file }) => ({
        id,
        name: file.name,
        status: '대기 중',
        message: '',
      })),
      ...prev,
    ]);

    setIsUploading(true);

    for (const { id, file } of stampedFiles) {
      updateStatus(id, { status: '업로드 중...' });
      try {
        await uploadSingleFile(file);
        updateStatus(id, { status: '완료', message: '' });
      } catch (err) {
        console.error('업로드 실패:', err);
        updateStatus(id, { status: '실패', message: err.message || '업로드 실패' });
      }
    }

    setIsUploading(false);
    e.target.value = '';
  };

  const triggerFileDialog = () => {
    if (isUploading) return;
    inputRef.current?.click();
  };

  if (variant === 'inline') {
    return (
      <div className="file-upload-inline">
        <input
          ref={inputRef}
          type="file"
          style={{ display: 'none' }}
          multiple
          accept=".xlsx,.csv,.json"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <button
          type="button"
          className="inline-upload-btn"
          onClick={triggerFileDialog}
          disabled={isUploading}
        >
          {isUploading ? '업로드 중...' : triggerLabel}
        </button>
        {error && <span className="inline-upload-error">{error}</span>}
      </div>
    );
  }

  return (
    <div className="file-upload">
      <h2>파일 선택</h2>
      <div className="upload-area">
        <label className="upload-label" htmlFor={inputId}>
          여러 파일을 선택하면 즉시 업로드됩니다.
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept=".xlsx,.csv,.json"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        {error && <div className="error">{error}</div>}
        {uploadStatuses.length > 0 && (
          <div className="upload-status-list">
            <p>최근 업로드</p>
            <ul>
              {uploadStatuses.map((item) => (
                <li key={item.id}>
                  <span className="file-name">{item.name}</span>
                  <span
                    className={`status-badge ${
                      item.status === '완료'
                        ? 'success'
                        : item.status === '실패'
                        ? 'error'
                        : ''
                    }`}
                  >
                    {item.status}
                  </span>
                  {item.message && (
                    <span className="status-message">{item.message}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;

