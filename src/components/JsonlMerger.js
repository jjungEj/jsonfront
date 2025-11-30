import React, { useState } from 'react';
import './JsonlMerger.css';

const JsonlMerger = () => {
  const [files, setFiles] = useState([]);
  const [merging, setMerging] = useState(false);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const jsonlFiles = selectedFiles.filter(file => 
      file.name.endsWith('.jsonl')
    );
    
    if (jsonlFiles.length !== selectedFiles.length) {
      alert('JSONL 파일만 선택할 수 있습니다.');
    }
    
    setFiles(jsonlFiles);
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      alert('병합할 JSONL 파일을 2개 이상 선택해주세요.');
      return;
    }

    setMerging(true);

    try {
      const fileContents = await Promise.all(
        files.map(file => 
          file.text().then(content => content)
        )
      );

      const response = await fetch('http://localhost:8080/api/files/merge-jsonl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fileContents),
      });

      if (!response.ok) {
        throw new Error('병합 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged.jsonl';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setFiles([]);
      document.getElementById('jsonl-file-input').value = '';
      alert('병합이 완료되었습니다.');
    } catch (error) {
      console.error('병합 실패:', error);
      alert('병합 중 오류가 발생했습니다.');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="jsonl-merger">
      <h2>JSONL 파일 병합</h2>
      <div className="merger-content">
        <input
          id="jsonl-file-input"
          type="file"
          accept=".jsonl"
          multiple
          onChange={handleFileChange}
          disabled={merging}
        />
        {files.length > 0 && (
          <div className="file-list">
            <p>선택된 파일 ({files.length}개):</p>
            <ul>
              {files.map((file, index) => (
                <li key={index}>{file.name}</li>
              ))}
            </ul>
            <button
              onClick={handleMerge}
              disabled={merging || files.length < 2}
              className="merge-button"
            >
              {merging ? '병합 중...' : '병합하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JsonlMerger;

