import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import HtmlEditor from './components/HtmlEditor';
import RecordList from './components/RecordList';
import JsonlMerger from './components/JsonlMerger';
import FileUpload from './components/FileUpload';

const normalizeConversionRecord = (record = {}) => {
  const id = record.id ?? record.recordId;
  if (id == null) {
    return { ...record };
  }

  return {
    ...record,
    id,
    originalTitle: record.originalTitle ?? record.title ?? record.fileName ?? '변환 결과',
    htmlContent: record.htmlContent ?? '',
  };
};

const normalizeUploadResponse = (response = {}) =>
  normalizeConversionRecord({
    ...response,
    id: response.recordId ?? response.id,
    originalTitle: response.title ?? response.originalTitle ?? response.fileName,
  });

const extractFileNameFromDisposition = (header) => {
  if (!header) {
    return null;
  }

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)(?:;|$)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/\+/g, '%20'));
    } catch (err) {
      console.warn('파일명 디코딩 실패:', err);
    }
  }

  const asciiMatch = header.match(/filename="?([^";]+)"?/i);
  return asciiMatch ? asciiMatch[1] : null;
};

const buildDefaultFileName = (records, selectedIds) => {
  if (selectedIds.length === 1) {
    const target = records.find((record) => record.id === selectedIds[0]);
    if (target) {
      const base = (target.originalTitle || target.fileName || 'converted').replace(/\.[^.]+$/, '');
      return `${base}.jsonl`;
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `records-${timestamp}.jsonl`;
};

const triggerDownload = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
};

function App() {
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedRecords, setSelectedRecords] = useState([]);

  const fetchRecords = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/api/files/records');
      const data = await response.json();
      const normalized = data.map(normalizeConversionRecord);
      setRecords(normalized);
      setSelectedRecord((prev) => {
        if (!prev) {
          return prev;
        }
        return normalized.find((record) => record.id === prev.id) || prev;
      });
    } catch (error) {
      console.error('레코드 조회 실패:', error);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleFileUploaded = (newRecord) => {
    const normalized = normalizeUploadResponse(newRecord);
    if (!normalized.id) {
      fetchRecords();
      return;
    }

    setRecords((prev) => {
      const others = prev.filter((record) => record.id !== normalized.id);
      return [normalized, ...others];
    });
    setSelectedRecord(normalized);
    fetchRecords();
  };

  const handleRecordSelect = (record) => {
    setSelectedRecord(record);
  };

  const handleRecordToggle = (recordId) => {
    if (recordId == null) {
      return;
    }

    setSelectedRecords((prev) => {
      if (prev.includes(recordId)) {
        return prev.filter((id) => id !== recordId);
      }
      return [...prev, recordId];
    });
  };

  const handleRecordUpdated = (updatedRecord) => {
    const normalized = normalizeConversionRecord(updatedRecord);
    if (!normalized.id) {
      return;
    }

    setRecords((prev) => {
      const exists = prev.some((record) => record.id === normalized.id);
      if (exists) {
        return prev.map((record) => (record.id === normalized.id ? normalized : record));
      }
      return [normalized, ...prev];
    });
    setSelectedRecord(normalized);
  };

  const handleDeleteRecord = async (recordIds) => {
    const idsToDelete = Array.isArray(recordIds) ? recordIds : [recordIds];
    
    if (idsToDelete.length === 0) {
      return;
    }

    try {
      const deletePromises = idsToDelete.map((id) =>
        fetch(`http://localhost:8080/api/files/records/${id}`, {
          method: 'DELETE',
        })
      );

      const responses = await Promise.all(deletePromises);
      const failed = responses.filter((response) => !response.ok);

      if (failed.length > 0) {
        throw new Error(`${failed.length}개 항목 삭제 실패`);
      }

      setRecords((prev) => prev.filter((record) => !idsToDelete.includes(record.id)));

      if (selectedRecord && idsToDelete.includes(selectedRecord.id)) {
        setSelectedRecord(null);
      }

      setSelectedRecords((prev) => prev.filter((id) => !idsToDelete.includes(id)));
      alert(`${idsToDelete.length}개 항목이 삭제되었습니다.`);
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDownloadJsonl = async () => {
    if (selectedRecords.length === 0) {
      alert('다운로드할 레코드를 선택해주세요.');
      return;
    }

    try {
      const requestedName = buildDefaultFileName(records, selectedRecords);
      const response = await fetch('http://localhost:8080/api/files/download-jsonl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordIds: selectedRecords,
          fileName: requestedName,
        }),
      });

      if (!response.ok) {
        throw new Error('JSONL 다운로드 실패');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const resolvedName = extractFileNameFromDisposition(contentDisposition) || requestedName;
      triggerDownload(blob, resolvedName);
      alert('JSONL 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleMergeSelectedRecords = async () => {
    if (selectedRecords.length < 2) {
      alert('병합할 레코드를 2개 이상 선택해주세요.');
      return;
    }

    const selectedJsonRecords = records.filter(
      (record) => selectedRecords.includes(record.id) && record.fileType === 'json'
    );

    if (selectedJsonRecords.length < 2) {
      alert('JSONL 파일로 변환된 항목을 2개 이상 선택해주세요.');
      return;
    }

    try {
      const mergedPieces = [];

      for (const record of selectedJsonRecords) {
        const response = await fetch('http://localhost:8080/api/files/download-jsonl', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recordIds: [record.id] }),
        });

        if (!response.ok) {
          throw new Error(`레코드 ${record.id} 다운로드 실패`);
        }

        const blob = await response.blob();
        const text = (await blob.text()).trim();
        if (text) {
          mergedPieces.push(text);
        }
      }

      if (mergedPieces.length === 0) {
        alert('병합할 JSONL 내용이 없습니다.');
        return;
      }

      const mergedContent = mergedPieces.join('\n') + '\n';
      const mergedBlob = new Blob([mergedContent], { type: 'application/x-ndjson' });
      const url = window.URL.createObjectURL(mergedBlob);
      const anchor = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      anchor.href = url;
      anchor.download = `merged-${timestamp}.jsonl`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);

      alert(`${selectedJsonRecords.length}개 JSONL 파일이 병합되었습니다.`);
    } catch (error) {
      console.error('JSONL 병합 실패:', error);
      alert('JSONL 병합 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Excel to HTML Converter</h1>
      </header>
      <div className="layout-grid">
        <div className="top-panels">
          <RecordList
            title="내가 올린 파일들"
            records={records}
            selectedRecord={selectedRecord}
            selectedRecords={selectedRecords}
            onRecordSelect={handleRecordSelect}
            onRecordToggle={handleRecordToggle}
            onDownload={handleDownloadJsonl}
            onMerge={handleMergeSelectedRecords}
            onRefresh={fetchRecords}
            onDelete={handleDeleteRecord}
            headerAction={
              <FileUpload
                onUploaded={handleFileUploaded}
                variant="inline"
                triggerLabel="파일 선택"
              />
            }
          />
          <JsonlMerger />
        </div>
        <div className="bottom-panel">
          <div className="editor-wrapper">
            {selectedRecord ? (
              <HtmlEditor
                record={selectedRecord}
                onRecordUpdate={handleRecordUpdated}
              />
            ) : (
              <div className="empty-state">
                <p>파일을 업로드하거나 레코드를 선택해주세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
