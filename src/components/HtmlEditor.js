import React, { useState, useEffect, useRef, useCallback } from 'react';
import './HtmlEditor.css';

const numberFormatter = new Intl.NumberFormat('ko-KR');
const numericPattern = /^-?\d+(\.\d+)?$/;
const formattedNumericPattern = /^-?\d{1,3}(,\d{3})*(\.\d+)?$/;
const TEXT_NODE = typeof Node !== 'undefined' ? Node.TEXT_NODE : 3;
const lastClickCache = { pos: null, timestamp: 0 };

const formatNumericCellText = (text) => {
  if (typeof text !== 'string') {
    return text;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return text;
  }

  // 이미 , 포함되거나 수치 외 문자 포함 시 변경하지 않음
  if (trimmed.includes(',') || trimmed.includes(' ')) {
    return trimmed;
  }

  if (!numericPattern.test(trimmed)) {
    return trimmed;
  }

  const unsigned = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
  const integerPart = unsigned.split('.')[0];

  // 매우 큰 정수나 0으로 시작하는 식별자(예: 00123)는 그대로 둠
  if (integerPart.length > 15 || (/^0\d/.test(unsigned) && !trimmed.includes('.'))) {
    return trimmed;
  }

  const isNegative = trimmed.startsWith('-');
  const [intPartRaw, decimalPartRaw] = unsigned.split('.');
  const parsedInt = Number(intPartRaw);

  if (!Number.isFinite(parsedInt)) {
    return trimmed;
  }

  const signedInt = isNegative ? -parsedInt : parsedInt;
  const formattedInt = numberFormatter.format(signedInt);

  if (!decimalPartRaw) {
    return formattedInt;
  }

  if (/^0+$/.test(decimalPartRaw)) {
    return formattedInt;
  }

  return `${formattedInt}.${decimalPartRaw}`;
};

const formatHtmlNumericStrings = (html) => {
  if (!html) {
    return '';
  }

  if (typeof document === 'undefined') {
    return html;
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  let mutated = false;

  const cells = wrapper.querySelectorAll('td, th');
  cells.forEach((cell) => {
    if (cell.childNodes.length !== 1) {
      return;
    }

    const firstChild = cell.childNodes[0];
    if (!firstChild || firstChild.nodeType !== TEXT_NODE) {
      return;
    }

    const originalText = firstChild.textContent || '';
    const formattedText = formatNumericCellText(originalText);
    if (formattedText !== originalText) {
      firstChild.textContent = formattedText;
      cell.setAttribute('data-auto-formatted', 'true');
      mutated = true;
    } else if (
      cell.hasAttribute('data-auto-formatted') &&
      !(formattedNumericPattern.test((firstChild.textContent || '').trim()))
    ) {
      cell.removeAttribute('data-auto-formatted');
      mutated = true;
    }
  });

  return mutated ? wrapper.innerHTML : html;
};

const stripNumericFormattingFromText = (text) => {
  if (typeof text !== 'string') {
    return text;
  }

  const trimmed = text.trim();
  if (!trimmed || !trimmed.includes(',')) {
    return text;
  }

  if (!formattedNumericPattern.test(trimmed)) {
    return text;
  }

  return trimmed.replace(/,/g, '');
};

const stripAutoFormattedNumericStrings = (html) => {
  if (!html) {
    return '';
  }

  if (typeof document === 'undefined') {
    return html;
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  let mutated = false;

  const cells = wrapper.querySelectorAll('td[data-auto-formatted="true"], th[data-auto-formatted="true"]');

  cells.forEach((cell) => {
    if (cell.childNodes.length === 1) {
      const firstChild = cell.childNodes[0];
      if (firstChild && firstChild.nodeType === TEXT_NODE) {
        const originalText = firstChild.textContent || '';
        const unformattedText = stripNumericFormattingFromText(originalText);
        if (unformattedText !== originalText) {
          firstChild.textContent = unformattedText;
          mutated = true;
        }
      }
    }

    if (cell.hasAttribute('data-auto-formatted')) {
      cell.removeAttribute('data-auto-formatted');
      mutated = true;
    }
  });

  return mutated ? wrapper.innerHTML : html;
};

const HtmlEditor = ({ record, onRecordUpdate = () => {} }) => {
  const [htmlContent, setHtmlContent] = useState(() => formatHtmlNumericStrings(record.htmlContent || ''));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCellIndices, setSelectedCellIndices] = useState([]); // [{row, col}, ...] 형태로 저장
  const [isDragging, setIsDragging] = useState(false);
  const [startCellIndex, setStartCellIndex] = useState(null);
  const tableRef = useRef(null);
  const editingCellRef = useRef(null); // 현재 편집 중인 셀
  const savedHtmlRef = useRef(htmlContent);

  const updateHtmlContent = useCallback((rawHtml) => {
    const normalized = formatHtmlNumericStrings(rawHtml || '');
    savedHtmlRef.current = normalized;
    setHtmlContent(normalized);
  }, []);

  const attachTableRef = useCallback((node) => {
    tableRef.current = node;
  }, []);

  useEffect(() => {
    const newHtml = record.htmlContent || '';
    updateHtmlContent(newHtml);
    setIsEditing(false);
    setSelectedCellIndices([]);
    setStartCellIndex(null);
    editingCellRef.current = null;
    
    // 레코드 변경 시 스타일 제거 (여러 번 실행)
    const removeStyles = () => {
      if (tableRef.current) {
        const allCells = tableRef.current.querySelectorAll('td, th');
        allCells.forEach(cell => {
          cell.classList.remove('cell-selected');
          cell.style.removeProperty('background-color');
          cell.style.removeProperty('border');
          cell.style.removeProperty('color');
          cell.style.removeProperty('font-weight');
        });
      }
    };
    
    removeStyles();
    setTimeout(removeStyles, 10);
    setTimeout(removeStyles, 50);
    setTimeout(removeStyles, 100);
  }, [record, updateHtmlContent]);

  // 셀 편집 (더블클릭) - 컨테이너 단위 이벤트 델리게이션
  const beginEditing = useCallback((cell) => {
    if (!cell) {
      return;
    }
    
    if (editingCellRef.current && editingCellRef.current !== cell) {
      editingCellRef.current.removeAttribute('contenteditable');
      editingCellRef.current.classList.remove('cell-editing');
    }
    
    setSelectedCellIndices([]);
    setStartCellIndex(null);
    setIsDragging(false);
    
    editingCellRef.current = cell;
    
    cell.setAttribute('contenteditable', 'true');
    cell.contentEditable = 'true';
    cell.classList.add('cell-editing');
    
    cell.style.setProperty('background-color', '#fffacd', 'important');
    cell.style.setProperty('border', '2px solid #007bff', 'important');
    cell.style.setProperty('color', '#000', 'important');
    cell.style.setProperty('font-weight', 'normal', 'important');
    cell.style.setProperty('user-select', 'text', 'important');
    cell.style.setProperty('-webkit-user-select', 'text', 'important');
    cell.classList.remove('cell-selected');
    
    requestAnimationFrame(() => {
      try {
        if (!cell.isConnected) {
          return;
        }
        
        cell.focus();
        
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          selection.removeAllRanges();
        }
        
        const range = document.createRange();
        
        if (!cell.isConnected) {
          return;
        }
        
        range.selectNodeContents(cell);
        range.collapse(false);
        
        if (range.startContainer && range.startContainer.isConnected) {
          selection.addRange(range);
        } else {
          cell.focus();
        }
      } catch (err) {
        console.error('포커스 설정 실패:', err);
        try {
          cell.focus();
        } catch (focusErr) {
          console.error('포커스도 실패:', focusErr);
        }
      }
    });
  }, []);

  const endEditing = useCallback((cell) => {
    if (!cell) return;
    cell.classList.remove('cell-editing');
    cell.removeAttribute('contenteditable');
    cell.contentEditable = 'false';
    if (editingCellRef.current === cell) {
      editingCellRef.current = null;
    }
    if (tableRef.current) {
      const newHtml = tableRef.current.innerHTML;
      updateHtmlContent(newHtml);
    }
  }, [updateHtmlContent]);

  const resolveCell = useCallback((target) => {
    const container = tableRef.current;
    if (!container) {
      return null;
    }

    let node = target;
    while (node && node !== container) {
      if (node.tagName === 'TD' || node.tagName === 'TH') {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }, []);

  const handleKeyDown = useCallback((event) => {
    if (!isEditing) {
      return;
    }

    const cell = resolveCell(event.target);
    if (!cell || !cell.classList.contains('cell-editing')) {
      return;
    }

    if (
      event.key.length === 1 ||
      event.key === 'Backspace' ||
      event.key === 'Delete' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown'
    ) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      cell.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      const savedHtml = savedHtmlRef.current;
      if (savedHtml && tableRef.current) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(savedHtml, 'text/html');
        const originalTable = doc.querySelector('table');
        if (originalTable) {
          const currentTable = tableRef.current.querySelector('table');
          if (currentTable) {
            const rows = Array.from(currentTable.rows);
            const originalRows = Array.from(originalTable.rows);
            
            for (let i = 0; i < rows.length; i++) {
              const cells = Array.from(rows[i].cells);
              const cellIndex = cells.indexOf(cell);
              if (cellIndex >= 0 && originalRows[i]) {
                const originalCells = Array.from(originalRows[i].cells);
                if (originalCells[cellIndex]) {
                  cell.innerHTML = originalCells[cellIndex].innerHTML;
                }
                break;
              }
            }
          }
        }
      }
      cell.blur();
    }
  }, [isEditing, resolveCell]);

  const handleBlur = useCallback((event) => {
    if (!isEditing) {
      return;
    }

    const cell = resolveCell(event.target);
    if (!cell) {
      return;
    }

    if (cell === editingCellRef.current) {
      endEditing(cell);
    }
  }, [isEditing, resolveCell, endEditing]);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    const container = tableRef.current;
    if (!container) {
      return;
    }

    const table = container.querySelector('table');
    if (!table) {
      return;
    }

    const cells = table.querySelectorAll('td, th');
    cells.forEach((cell) => {
      cell.removeAttribute('contenteditable');
      cell.classList.remove('cell-editing');
    });
  }, [isEditing, htmlContent]);


  // 인덱스로 셀 찾기
  const getCellByIndex = (rowIndex, colIndex) => {
    if (!tableRef.current) return null;
    const table = tableRef.current.querySelector('table');
    if (!table) return null;
    const rows = Array.from(table.rows);
    if (rowIndex < 0 || rowIndex >= rows.length) return null;
    const row = rows[rowIndex];
    const cells = Array.from(row.cells);
    if (colIndex < 0 || colIndex >= cells.length) return null;
    return cells[colIndex];
  };

  // 테이블 셀 맵 구축 (rowspan, colspan 고려)
  const buildTableCellMaps = (table) => {
    const matrix = [];
    const cellMetaMap = new Map();
    const rows = Array.from(table.rows);

    rows.forEach((row, rowIdx) => {
      const rowData = [];
      let colIdx = 0;

      Array.from(row.cells).forEach((cell) => {
        // 이미 다른 셀의 colspan/rowspan으로 차지된 위치 건너뛰기
        while (rowData[colIdx]) {
          colIdx++;
        }

        const rowspan = parseInt(cell.getAttribute('rowspan') || '1');
        const colspan = parseInt(cell.getAttribute('colspan') || '1');

        // 셀 메타데이터 저장
        cellMetaMap.set(cell, {
          rowIndex: rowIdx,
          colIndex: colIdx,
          rowspan,
          colspan,
        });

        // 매트릭스에 셀 배치
        for (let r = 0; r < rowspan; r++) {
          for (let c = 0; c < colspan; c++) {
            const actualRow = rowIdx + r;
            const actualCol = colIdx + c;
            if (!matrix[actualRow]) {
              matrix[actualRow] = [];
            }
            matrix[actualRow][actualCol] = cell;
          }
        }

        rowData[colIdx] = cell;
        colIdx += colspan;
      });

      matrix[rowIdx] = rowData;
    });

    return { matrix, cellMetaMap };
  };

  // 좌표로 셀 찾기
  const findCellByCoordinates = (matrix, rowIndex, colIndex) => {
    if (!matrix[rowIndex] || !matrix[rowIndex][colIndex]) {
      return null;
    }
    return matrix[rowIndex][colIndex];
  };

  // 선택된 셀 스타일 적용 함수
  const applyCellStyles = useCallback(() => {
    if (!tableRef.current) return;
    
    // 편집 모드가 아니면 모든 스타일 제거만 하고 리턴
    if (!isEditing) {
      const allCells = tableRef.current.querySelectorAll('td, th');
      allCells.forEach(cell => {
        cell.classList.remove('cell-selected');
        cell.style.removeProperty('background-color');
        cell.style.removeProperty('border');
        cell.style.removeProperty('color');
        cell.style.removeProperty('font-weight');
      });
      return;
    }
    
    const allCells = tableRef.current.querySelectorAll('td, th');
    allCells.forEach(cell => {
      // 편집 중인 셀은 스타일 제거하지 않음
      if (cell.classList.contains('cell-editing') || cell.contentEditable === 'true') {
        // 편집 중인 셀은 user-select를 text로 유지
        cell.style.setProperty('user-select', 'text', 'important');
        cell.style.setProperty('-webkit-user-select', 'text', 'important');
        return;
      }
      // 클래스 제거
      cell.classList.remove('cell-selected');
      // 인라인 스타일 제거
      cell.style.removeProperty('background-color');
      cell.style.removeProperty('border');
      cell.style.removeProperty('color');
      cell.style.removeProperty('font-weight');
    });
    
    // 편집 모드일 때만 선택된 셀 스타일 적용
    if (selectedCellIndices.length > 0) {
      selectedCellIndices.forEach(({ row, col }) => {
        const cell = getCellByIndex(row, col);
        if (cell) {
          try {
            // 클래스 추가
            cell.classList.add('cell-selected');
            // 인라인 스타일 직접 적용
            cell.style.setProperty('background-color', '#4da6ff', 'important');
            cell.style.setProperty('border', '2px solid #0066cc', 'important');
            cell.style.setProperty('color', 'white', 'important');
            cell.style.setProperty('font-weight', '500', 'important');
          } catch (e) {
            console.error('셀 스타일 적용 실패:', e);
          }
        }
      });
    }
  }, [isEditing, selectedCellIndices]);

  useEffect(() => {
    if (!tableRef.current) return;
    
    // 편집 모드일 때
    if (isEditing) {
      // 약간의 지연 후 적용 (DOM이 완전히 렌더링된 후)
      const timer1 = setTimeout(applyCellStyles, 0);
      const timer2 = setTimeout(applyCellStyles, 50);
      const timer3 = setTimeout(applyCellStyles, 100);
      
      // 주기적으로 스타일 다시 적용 (dangerouslySetInnerHTML 때문에 스타일이 사라질 수 있음)
      // 단, 선택된 셀이 있을 때만 실행
      // 편집 중인 셀이 있으면 실행하지 않음
      const interval = selectedCellIndices.length > 0 && !editingCellRef.current
        ? setInterval(applyCellStyles, 200)
        : null;
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        if (interval) clearInterval(interval);
      };
    } else {
      // 편집 모드가 아닐 때는 모든 스타일 제거
      const removeStyles = () => {
        if (!tableRef.current) return;
        const allCells = tableRef.current.querySelectorAll('td, th');
        allCells.forEach(cell => {
          // 편집 중인 셀은 제외
          if (cell.classList.contains('cell-editing') || cell.contentEditable === 'true') {
            return;
          }
          cell.classList.remove('cell-selected');
          cell.style.removeProperty('background-color');
          cell.style.removeProperty('border');
          cell.style.removeProperty('color');
          cell.style.removeProperty('font-weight');
        });
      };
      
      // 즉시 제거
      removeStyles();
      
      // htmlContent 변경 시에도 제거
      setTimeout(removeStyles, 0);
      setTimeout(removeStyles, 10);
      setTimeout(removeStyles, 50);
      
      // 주기적으로 확인하여 스타일 제거 (더 자주 실행)
      const interval = setInterval(removeStyles, 30);
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [selectedCellIndices, isEditing, htmlContent, applyCellStyles]);

  const handleSave = async () => {
    const recordId = record?.id ?? record?.recordId;
    if (!recordId) {
      alert('레코드 식별자를 찾을 수 없습니다.');
      return;
    }

    setSaving(true);
    try {
      // 먼저 모든 스타일 제거
      if (tableRef.current) {
        const allCells = tableRef.current.querySelectorAll('td, th');
        allCells.forEach(cell => {
          cell.classList.remove('cell-selected');
          cell.style.removeProperty('background-color');
          cell.style.removeProperty('border');
          cell.style.removeProperty('color');
          cell.style.removeProperty('font-weight');
        });
      }
      
      // 선택 초기화 (스타일 제거 후)
      setSelectedCellIndices([]);
      setStartCellIndex(null);
      
      // 현재 HTML 가져오기
      const currentHtml = tableRef.current ? tableRef.current.innerHTML : htmlContent;
      
      const payloadHtml = stripAutoFormattedNumericStrings(currentHtml);
      
      const response = await fetch('http://localhost:8080/api/files/update-html', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordId,
          htmlContent: payloadHtml,
        }),
      });

      if (!response.ok) {
        throw new Error('저장 실패');
      }

      const updatedRecord = await response.json();

      // 편집 모드 종료 (먼저 종료)
      setIsEditing(false);
      
      if (updatedRecord?.htmlContent) {
        updateHtmlContent(updatedRecord.htmlContent);
      }
      
      await onRecordUpdate(updatedRecord);
      
      // 저장 후 여러 번 스타일 제거 (업데이트 후 DOM이 재렌더링될 수 있음)
      const removeStyles = () => {
        if (tableRef.current) {
          const allCells = tableRef.current.querySelectorAll('td, th');
          allCells.forEach(cell => {
            cell.classList.remove('cell-selected');
            cell.style.removeProperty('background-color');
            cell.style.removeProperty('border');
            cell.style.removeProperty('color');
            cell.style.removeProperty('font-weight');
          });
        }
      };
      
      removeStyles();
      setTimeout(removeStyles, 10);
      setTimeout(removeStyles, 50);
      setTimeout(removeStyles, 100);
      setTimeout(removeStyles, 200);
      
      alert('저장되었습니다.');
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getCellElement = (element) => {
    let node = element;
    while (node && node !== tableRef.current) {
      if (node.tagName === 'TD' || node.tagName === 'TH') {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

  const getCellPosition = (cell) => {
    const table = cell.closest('table');
    if (!table) return null;
    
    const rows = Array.from(table.rows);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const cells = Array.from(row.cells);
      for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
        if (cells[cellIndex] === cell) {
          return { row: rowIndex, col: cellIndex };
        }
      }
    }
    return null;
  };

  const getCellIndicesBetween = (startPos, endPos) => {
    if (!startPos || !endPos) return [];
    
    const indices = [];
    
    // 시작과 끝 위치의 최소/최대값 계산
    const minRow = Math.min(startPos.row, endPos.row);
    const maxRow = Math.max(startPos.row, endPos.row);
    const minCol = Math.min(startPos.col, endPos.col);
    const maxCol = Math.max(startPos.col, endPos.col);
    
    // 사각형 영역의 모든 셀 선택
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        indices.push({ row, col });
      }
    }
    
    return indices;
  };

  const handleMouseDown = (e) => {
    if (!isEditing) return;
    
    const cell = getCellElement(e.target);
    const cellPos = cell ? getCellPosition(cell) : null;
    const now = Date.now();
    const lastClick = lastClickCache;
    const isSameCell =
      cellPos &&
      lastClick.pos &&
      lastClick.pos.row === cellPos.row &&
      lastClick.pos.col === cellPos.col;
    const withinThreshold = now - lastClick.timestamp < 400;
    const isDoubleClick = e.detail >= 2 || (isSameCell && withinThreshold);
    
    if (cellPos) {
      lastClickCache.pos = cellPos;
      lastClickCache.timestamp = now;
    }
    
    // 더블클릭이면 즉시 편집
    if (isDoubleClick) {
      if (cell) {
        setIsDragging(false);
        setSelectedCellIndices([]);
        setStartCellIndex(null);
        beginEditing(cell);
      }
      return;
    }
    
    if (cell && (cell.tagName === 'TD' || cell.tagName === 'TH')) {
      // contentEditable이 활성화된 셀은 드래그 선택 안함
      if (cell.contentEditable === 'true' || cell.classList.contains('cell-editing')) {
        return;
      }
      
      // 단일 클릭일 때만 드래그 선택 시작
      const pos = getCellPosition(cell);
      if (pos) {
        setIsDragging(true);
        setStartCellIndex(pos);
        setSelectedCellIndices([pos]);
      }
    }
  };

  const handleDoubleClick = useCallback((event) => {
    if (!isEditing) {
      return;
    }

    const cell = resolveCell(event.target);
    if (!cell) {
      return;
    }

    event.preventDefault();
    setIsDragging(false);
    setSelectedCellIndices([]);
    setStartCellIndex(null);
    beginEditing(cell);
  }, [isEditing, resolveCell, beginEditing]);

  const handleClickCapture = useCallback((event) => {
    if (!isEditing || event.detail < 2) {
      return;
    }

    const cell = resolveCell(event.target);
    if (!cell) {
      return;
    }

    event.preventDefault();
    setIsDragging(false);
    setSelectedCellIndices([]);
    setStartCellIndex(null);
    beginEditing(cell);
  }, [isEditing, resolveCell, beginEditing]);

  const handleMouseMove = (e) => {
    if (!isEditing || !isDragging || !startCellIndex) return;
    
    e.preventDefault();
    
    // 가로 스크롤 자동 이동
    if (tableRef.current) {
      const scrollContainer =
        tableRef.current.closest('.editor-scroll') ||
        tableRef.current.closest('.editor-content');
      if (scrollContainer) {
        const rect = scrollContainer.getBoundingClientRect();
        const mouseX = e.clientX;
        const scrollSpeed = 10;
        
        // 오른쪽 끝 근처에서 오른쪽으로 스크롤
        if (mouseX > rect.right - 50) {
          scrollContainer.scrollLeft += scrollSpeed;
        }
        // 왼쪽 끝 근처에서 왼쪽으로 스크롤
        else if (mouseX < rect.left + 50) {
          scrollContainer.scrollLeft -= scrollSpeed;
        }
      }
    }
    
    const cell = getCellElement(e.target);
    if (cell) {
      const endPos = getCellPosition(cell);
      if (endPos) {
        const indices = getCellIndicesBetween(startCellIndex, endPos);
        setSelectedCellIndices(indices);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };


  const handleCellBlur = (e) => {
    if (e.target.tagName === 'TD' || e.target.tagName === 'TH') {
      e.target.contentEditable = 'false';
      // 업데이트된 HTML 가져오기
      if (tableRef.current) {
        updateHtmlContent(tableRef.current.innerHTML);
      }
    }
  };

  const handleMergeCells = () => {
    if (selectedCellIndices.length < 2) {
      alert('병합할 셀을 2개 이상 선택해주세요. 드래그로 셀을 선택해주세요.');
      return;
    }

    if (!tableRef.current) return;
    
    const table = tableRef.current.querySelector('table');
    if (!table) return;

    // 테이블 맵 구축
    const { matrix, cellMetaMap } = buildTableCellMaps(table);

    // 선택된 셀들을 정렬
    const sortedIndices = [...selectedCellIndices].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    // 선택된 셀 요소들을 찾아서 Set에 저장
    const selectedCellSet = new Set();
    for (const idx of sortedIndices) {
      const cellElement = findCellByCoordinates(matrix, idx.row, idx.col);
      if (!cellElement) {
        alert('선택한 영역을 해석할 수 없습니다.');
        return;
      }
      selectedCellSet.add(cellElement);
    }

    if (selectedCellSet.size < 2) {
      alert('병합할 셀을 2개 이상 선택해주세요.');
      return;
    }

    // 선택된 영역의 최소/최대 행/열 계산 (rowspan, colspan 고려)
    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;

    for (const cellElement of selectedCellSet) {
      const meta = cellMetaMap.get(cellElement);
      if (!meta) continue;
      const { rowIndex, colIndex, rowspan = 1, colspan = 1 } = meta;
      minRow = Math.min(minRow, rowIndex);
      minCol = Math.min(minCol, colIndex);
      maxRow = Math.max(maxRow, rowIndex + rowspan - 1);
      maxCol = Math.max(maxCol, colIndex + colspan - 1);
    }

    // 병합 기준 셀 찾기 (좌상단 셀)
    const mainCellElement = findCellByCoordinates(matrix, minRow, minCol);
    if (!mainCellElement || !selectedCellSet.has(mainCellElement)) {
      alert('병합 기준 셀을 찾을 수 없습니다.');
      return;
    }

    // 선택된 영역의 모든 셀 내용 수집
    const contentPieces = [];
    const processedCells = new Set();

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const occupant = findCellByCoordinates(matrix, r, c);
        if (!occupant || processedCells.has(occupant) || !selectedCellSet.has(occupant)) {
          continue;
        }
        const cellContent = occupant.innerHTML.trim();
        if (cellContent) {
          contentPieces.push(cellContent);
        }
        processedCells.add(occupant);
      }
    }

    // 내용 병합
    const mergedContent = contentPieces.join(' ').trim();
    const rowSpan = maxRow - minRow + 1;
    const colSpan = maxCol - minCol + 1;

    // 나머지 셀 제거
    const cellsToRemove = Array.from(selectedCellSet).filter(cell => cell !== mainCellElement);
    cellsToRemove.forEach(cell => {
      if (cell.parentElement) {
        cell.remove();
      }
    });

    // 병합된 셀에 rowspan, colspan 설정
    mainCellElement.setAttribute('rowspan', rowSpan.toString());
    mainCellElement.setAttribute('colspan', colSpan.toString());
    if (mergedContent) {
      mainCellElement.innerHTML = mergedContent;
    }

    // 선택 초기화 (HTML 업데이트 전에 먼저 초기화)
    setSelectedCellIndices([]);
    setStartCellIndex(null);

    // HTML 업데이트
    if (tableRef.current) {
      const newHtml = tableRef.current.innerHTML;
      
      // 스타일 즉시 제거 (HTML 업데이트 전)
      const allCells = tableRef.current.querySelectorAll('td, th');
      allCells.forEach(cell => {
        cell.classList.remove('cell-selected');
        cell.style.removeProperty('background-color');
        cell.style.removeProperty('border');
        cell.style.removeProperty('color');
        cell.style.removeProperty('font-weight');
      });
      
      // HTML 업데이트
      updateHtmlContent(newHtml);
    }
  };

  return (
    <div className="html-editor">
      <div className="editor-header">
        <h2>{record.originalTitle || record.fileName}</h2>
        <div className="editor-actions">
          {isEditing ? (
            <>
              <div className="selection-info">
                {selectedCellIndices.length > 0 && (
                  <span>{selectedCellIndices.length}개 셀 선택됨</span>
                )}
              </div>
              <button 
                onClick={handleMergeCells} 
                className="merge-btn"
                disabled={selectedCellIndices.length < 2}
              >
                선택 셀 병합 ({selectedCellIndices.length})
              </button>
              <button onClick={handleSave} disabled={saving} className="save-btn">
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => {
                  updateHtmlContent(record.htmlContent);
                  setSelectedCellIndices([]);
                  setStartCellIndex(null);
                  setIsEditing(false);
                  // 편집 모드 종료 시 모든 셀의 contentEditable 해제
                  if (tableRef.current) {
                    const allCells = tableRef.current.querySelectorAll('td[contenteditable="true"], th[contenteditable="true"]');
                    allCells.forEach(cell => {
                      cell.contentEditable = 'false';
                      cell.classList.remove('cell-editing');
                    });
                  }
                  editingCellRef.current = null;
                }}
                className="cancel-btn"
              >
                취소
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="edit-btn">
              편집
            </button>
          )}
        </div>
      </div>
      <div className="editor-content">
        <div className="editor-scroll">
          {isEditing ? (
            <div
              ref={attachTableRef}
              className="editable-table excel-preview"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDoubleClickCapture={handleDoubleClick}
              onClickCapture={handleClickCapture}
              onKeyDownCapture={handleKeyDown}
              onBlurCapture={handleBlur}
              style={{ userSelect: 'none' }}
            />
          ) : (
            <div
              className="preview-table excel-preview"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default HtmlEditor;

