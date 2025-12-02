import React, { useState, useMemo } from 'react';
import './RecordList.css';

const RecordList = ({
  title = '변환 기록',
  records,
  selectedRecord,
  selectedRecords,
  onRecordSelect,
  onRecordToggle,
  onDownload,
  onRefresh,
  onDelete,
  onMerge = () => {},
}) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'excel', 'json'
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageExcel, setCurrentPageExcel] = useState(1);
  const [currentPageJson, setCurrentPageJson] = useState(1);
  const itemsPerPage = 10;

  // 파일 타입별로 분류
  const excelRecords = useMemo(() => 
    records.filter(r => r.fileType === 'xlsx' || r.fileType === 'csv'), 
    [records]
  );
  const jsonRecords = useMemo(() => 
    records.filter(r => r.fileType === 'json'), 
    [records]
  );

  // 현재 탭에 따른 레코드 선택
  const currentRecords = useMemo(() => {
    if (activeTab === 'excel') return excelRecords;
    if (activeTab === 'json') return jsonRecords;
    return records;
  }, [activeTab, records, excelRecords, jsonRecords]);

  // 페이지네이션
  const getCurrentPage = () => {
    if (activeTab === 'excel') return currentPageExcel;
    if (activeTab === 'json') return currentPageJson;
    return currentPage;
  };

  const setCurrentPageForTab = (page) => {
    if (activeTab === 'excel') setCurrentPageExcel(page);
    else if (activeTab === 'json') setCurrentPageJson(page);
    else setCurrentPage(page);
  };

  const totalPages = Math.ceil(currentRecords.length / itemsPerPage);
  const currentPageNum = getCurrentPage();
  const startIndex = (currentPageNum - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = currentRecords.slice(startIndex, endIndex);

  const selectedJsonCount = useMemo(
    () =>
      selectedRecords.filter((id) => {
        const target = records.find((record) => record.id === id);
        return target?.fileType === 'json';
      }).length,
    [records, selectedRecords]
  );

  // 전체 선택/해제
  const allSelected = paginatedRecords.length > 0 && 
    paginatedRecords.every(r => selectedRecords.includes(r.id));
  const someSelected = paginatedRecords.some(r => selectedRecords.includes(r.id));

  const handleSelectAll = () => {
    if (allSelected) {
      // 현재 페이지의 모든 항목 선택 해제
      paginatedRecords.forEach(record => {
        if (selectedRecords.includes(record.id)) {
          onRecordToggle(record.id);
        }
      });
    } else {
      // 현재 페이지의 모든 항목 선택
      paginatedRecords.forEach(record => {
        if (!selectedRecords.includes(record.id)) {
          onRecordToggle(record.id);
        }
      });
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPageForTab(1);
  };

  return (
    <div className="record-list">
      <div className="record-list-header">
        <h2>{title}</h2>
        <button onClick={onRefresh} className="refresh-btn">새로고침</button>
      </div>
      
      {/* 탭 메뉴 */}
      <div className="record-tabs">
        <button
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => handleTabChange('all')}
        >
          전체 ({records.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'excel' ? 'active' : ''}`}
          onClick={() => handleTabChange('excel')}
        >
          엑셀/CSV ({excelRecords.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => handleTabChange('json')}
        >
          JSON ({jsonRecords.length})
        </button>
      </div>

      <div className="record-actions">
        <div className="select-all-container">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(input) => {
              if (input) input.indeterminate = someSelected && !allSelected;
            }}
            onChange={handleSelectAll}
          />
          <span>전체 선택</span>
        </div>
        <div className="action-buttons">
          <button
            onClick={onDownload}
            disabled={selectedRecords.length === 0}
            className="download-btn"
          >
            JSONL 다운로드 ({selectedRecords.length})
          </button>
          <button
            onClick={() => {
              if (selectedJsonCount < 2) {
                alert('JSONL 파일을 2개 이상 선택해주세요.');
                return;
              }
              onMerge();
            }}
            disabled={selectedJsonCount < 2}
            className="merge-selected-btn"
            title="JSONL 파일만 병합할 수 있습니다."
          >
            JSONL 병합 ({selectedJsonCount})
          </button>
          <button
            onClick={() => {
              if (selectedRecords.length === 0) {
                alert('삭제할 레코드를 선택해주세요.');
                return;
              }
              if (window.confirm(`선택한 ${selectedRecords.length}개 항목을 삭제하시겠습니까?`)) {
                onDelete(selectedRecords);
              }
            }}
            disabled={selectedRecords.length === 0}
            className="delete-selected-btn"
          >
            선택 삭제 ({selectedRecords.length})
          </button>
        </div>
        {selectedRecords.length > 0 && selectedJsonCount < selectedRecords.length && (
          <p className="action-hint">JSONL 파일만 병합 대상에 포함됩니다.</p>
        )}
      </div>
      <div className="records">
        {paginatedRecords.length === 0 ? (
          <p className="empty">변환된 파일이 없습니다.</p>
        ) : (
          paginatedRecords.map((record) => (
            <div
              key={record.id}
              className={`record-item ${
                selectedRecord?.id === record.id ? 'selected' : ''
              }`}
              onClick={() => onRecordSelect(record)}
            >
              <div className="record-checkbox">
                <input
                  type="checkbox"
                  checked={selectedRecords.includes(record.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onRecordToggle(record.id);
                  }}
                />
              </div>
              <div className="record-info">
                <div className="record-title">{record.originalTitle || record.fileName}</div>
                <span className="record-date">
                  {new Date(record.createdAt).toLocaleDateString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit'
                  })}
                </span>
                <span className="record-type">{record.fileType.toUpperCase()}</span>
              </div>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('정말 삭제하시겠습니까?')) {
                    onDelete([record.id]);
                  }
                }}
                title="삭제"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      
      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPageForTab(Math.max(1, currentPageNum - 1))}
            disabled={currentPageNum === 1}
            className="page-btn"
          >
            이전
          </button>
          <span className="page-info">
            {currentPageNum} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPageForTab(Math.min(totalPages, currentPageNum + 1))}
            disabled={currentPageNum === totalPages}
            className="page-btn"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};

export default RecordList;

