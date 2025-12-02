import React, { useState, useEffect } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import HtmlEditor from './components/HtmlEditor';
import RecordList from './components/RecordList';
import JsonlMerger from './components/JsonlMerger';

function App() {
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedRecords, setSelectedRecords] = useState([]);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/files/records');
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error('레코드 조회 실패:', error);
    }
  };

  const handleFileUploaded = (newRecord) => {
    fetchRecords();
    setSelectedRecord(newRecord);
  };

  const handleRecordSelect = (record) => {
    setSelectedRecord(record);
  };

  const handleRecordToggle = (recordId) => {
    setSelectedRecords(prev => {
      if (prev.includes(recordId)) {
        return prev.filter(id => id !== recordId);
      } else {
        return [...prev, recordId];
      }
    });
  };

  const handleDeleteRecord = async (recordIds) => {
    // 단일 ID 또는 배열 모두 처리
    const idsToDelete = Array.isArray(recordIds) ? recordIds : [recordIds];
    
    if (idsToDelete.length === 0) {
      return;
    }

    try {
      // 각 레코드를 순차적으로 삭제
      const deletePromises = idsToDelete.map(id => 
        fetch(`http://localhost:8080/api/files/records/${id}`, {
          method: 'DELETE',
        })
      );

      const responses = await Promise.all(deletePromises);
      const failed = responses.filter(r => !r.ok);

      if (failed.length > 0) {
        throw new Error(`${failed.length}개 항목 삭제 실패`);
      }

      // 삭제된 레코드가 현재 선택된 레코드라면 선택 해제
      if (selectedRecord && idsToDelete.includes(selectedRecord.id)) {
        setSelectedRecord(null);
      }
      
      // 선택된 레코드 목록에서도 제거
      setSelectedRecords(prev => prev.filter(id => !idsToDelete.includes(id)));
      
      // 목록 새로고침
      fetchRecords();
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
      // 각 레코드를 개별 파일로 다운로드
      for (const recordId of selectedRecords) {
        const record = records.find(r => r.id === recordId);
        if (!record) continue;

        const response = await fetch('http://localhost:8080/api/files/download-jsonl', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recordIds: [recordId] }),
        });

        if (!response.ok) {
          console.error(`레코드 ${recordId} 다운로드 실패`);
          continue;
        }

        // 파일명 결정: 먼저 레코드 정보에서 직접 생성
        let fileName = 'converted.jsonl';
        const title = record.originalTitle || record.fileName;
        if (title) {
          const lastDot = title.lastIndexOf('.');
          fileName = (lastDot > 0 ? title.substring(0, lastDot) : title) + '.jsonl';
        }

        // Content-Disposition 헤더에서 파일명 추출 시도 (있으면 사용)
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
          // filename*=UTF-8'' 형식 처리
          const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/);
          if (utf8Match) {
            try {
              const decoded = decodeURIComponent(utf8Match[1]);
              if (decoded && decoded !== 'converted.jsonl') {
                fileName = decoded;
              }
            } catch (e) {
              console.log('UTF-8 파일명 디코딩 실패:', e);
            }
          } else {
            // filename= 형식 처리
            const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (fileNameMatch && fileNameMatch[1]) {
              const extracted = fileNameMatch[1].replace(/['"]/g, '');
              if (extracted && extracted !== 'converted.jsonl') {
                fileName = extracted;
              }
            }
          }
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // 다운로드 간 약간의 지연 (브라우저가 각 파일을 처리할 시간 제공)
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      alert(`${selectedRecords.length}개 파일이 다운로드되었습니다.`);
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Excel to HTML Converter</h1>
      </header>
      <div className="layout-grid">
        <div className="left-column">
          <FileUpload onUploaded={handleFileUploaded} />
          <RecordList
            title="내가 올린 파일들"
            records={records}
            selectedRecord={selectedRecord}
            selectedRecords={selectedRecords}
            onRecordSelect={handleRecordSelect}
            onRecordToggle={handleRecordToggle}
            onDownload={handleDownloadJsonl}
            onRefresh={fetchRecords}
            onDelete={handleDeleteRecord}
          />
        </div>
        <div className="right-column">
          <JsonlMerger />
          <div className="editor-wrapper">
            {selectedRecord ? (
              <HtmlEditor
                record={selectedRecord}
                onUpdate={fetchRecords}
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
