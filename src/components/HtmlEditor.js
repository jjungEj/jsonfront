import React, { useState, useEffect, useRef, useCallback } from 'react';
import './HtmlEditor.css';

const HtmlEditor = ({ record, onUpdate }) => {
  const [htmlContent, setHtmlContent] = useState(record.htmlContent || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCellIndices, setSelectedCellIndices] = useState([]); // [{row, col}, ...] 형태로 저장
  const [isDragging, setIsDragging] = useState(false);
  const [startCellIndex, setStartCellIndex] = useState(null);
  const tableRef = useRef(null);
  const editingCellRef = useRef(null); // 현재 편집 중인 셀

  useEffect(() => {
    const newHtml = record.htmlContent || '';
    setHtmlContent(newHtml);
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
  }, [record]);

  // 셀 편집 (더블클릭) - QA.js 방식: 각 셀에 직접 이벤트 리스너 추가 + MutationObserver로 재바인딩
  useEffect(() => {
    if (!isEditing || !tableRef.current) return;

    let observer = null;
    let savedHtmlContent = htmlContent;
    let eventBindings = [];

      const beginEditing = (cell) => {
        if (!cell) {
          console.log('beginEditing: cell이 null입니다');
          return;
        }
        
        console.log('=== beginEditing 호출 ===');
        console.log('셀:', cell);
        console.log('셀 내용:', cell.textContent?.substring(0, 30));
        console.log('셀이 document에 연결됨:', cell.isConnected);
        
        // 이전 편집 셀 종료
        if (editingCellRef.current && editingCellRef.current !== cell) {
          console.log('이전 편집 셀 종료:', editingCellRef.current);
          editingCellRef.current.removeAttribute('contenteditable');
          editingCellRef.current.classList.remove('cell-editing');
        }
        
        // 선택 초기화
        setSelectedCellIndices([]);
        setStartCellIndex(null);
        setIsDragging(false);
        
        editingCellRef.current = cell;
        
        // contentEditable 설정
        console.log('contentEditable 설정 전:', {
          contentEditable: cell.contentEditable,
          attribute: cell.getAttribute('contenteditable'),
          hasClass: cell.classList.contains('cell-editing')
        });
        
        cell.setAttribute('contenteditable', 'true');
        cell.contentEditable = 'true';
        cell.classList.add('cell-editing');
        
        console.log('contentEditable 설정 후:', {
          contentEditable: cell.contentEditable,
          attribute: cell.getAttribute('contenteditable'),
          hasClass: cell.classList.contains('cell-editing')
        });
        
        // 스타일 제거 (편집 가능하도록) - !important로 덮어쓰기
        cell.style.setProperty('background-color', '#fffacd', 'important');
        cell.style.setProperty('border', '2px solid #007bff', 'important');
        cell.style.setProperty('color', '#000', 'important');
        cell.style.setProperty('font-weight', 'normal', 'important');
        cell.style.setProperty('user-select', 'text', 'important');
        cell.style.setProperty('-webkit-user-select', 'text', 'important');
        cell.classList.remove('cell-selected');
        
        console.log('스타일 설정 완료:', {
          backgroundColor: cell.style.backgroundColor,
          userSelect: cell.style.userSelect
        });
        
        // 포커스 및 커서 설정 (QA.js 방식: requestAnimationFrame 사용)
        requestAnimationFrame(() => {
          try {
            // cell이 여전히 document에 연결되어 있는지 확인
            if (!cell.isConnected) {
              console.log('셀이 document에서 분리됨');
              return;
            }
            
            console.log('포커스 시도');
            cell.focus();
            console.log('포커스 완료, document.activeElement:', document.activeElement);
            
            // range를 생성하고 즉시 사용
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
              selection.removeAllRanges();
            }
            
            const range = document.createRange();
            
            // cell이 여전히 유효한지 다시 확인
            if (!cell.isConnected) {
              console.log('셀이 range 생성 중 document에서 분리됨');
              return;
            }
            
            range.selectNodeContents(cell);
            range.collapse(false);
            
            // range가 유효한지 확인
            if (range.startContainer && range.startContainer.isConnected) {
              selection.addRange(range);
              console.log('포커스 및 커서 설정 완료');
            } else {
              console.log('range가 유효하지 않음');
              // 대체 방법: 단순히 포커스만
              cell.focus();
            }
          } catch (err) {
            console.error('포커스 설정 실패:', err);
            // 에러가 발생해도 포커스는 시도
            try {
              cell.focus();
            } catch (focusErr) {
              console.error('포커스도 실패:', focusErr);
            }
          }
        });
      };

    const endEditing = (cell) => {
      if (!cell) return;
      cell.classList.remove('cell-editing');
      cell.removeAttribute('contenteditable');
      cell.contentEditable = 'false';
      if (editingCellRef.current === cell) {
        editingCellRef.current = null;
      }
      // HTML 업데이트
      if (tableRef.current) {
        const newHtml = tableRef.current.innerHTML;
        setHtmlContent(newHtml);
        savedHtmlContent = newHtml;
      }
    };

    // QA.js 방식: 각 셀에 직접 이벤트 리스너 추가
    const setupEventHandlers = () => {
      if (!tableRef.current) return;
      
      // 기존 이벤트 리스너 제거
      eventBindings.forEach(({ cell, type, handler }) => {
        if (cell && cell.removeEventListener) {
          cell.removeEventListener(type, handler);
        }
      });
      eventBindings = [];

      const cells = tableRef.current.querySelectorAll('td, th');
      if (cells.length === 0) return;

      const createDblClickHandler = (cell) => (event) => {
        console.log('=== 더블클릭 이벤트 발생 ===');
        console.log('셀:', cell);
        console.log('셀 내용:', cell.textContent?.substring(0, 30));
        console.log('이벤트:', event);
        console.log('contentEditable:', cell.contentEditable);
        console.log('cell-editing 클래스:', cell.classList.contains('cell-editing'));
        
        // 다른 이벤트가 방해하지 않도록 먼저 처리
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        // 드래그 상태 초기화
        setIsDragging(false);
        setSelectedCellIndices([]);
        setStartCellIndex(null);
        
        // 편집 시작
        console.log('beginEditing 호출 전');
        beginEditing(cell);
        console.log('beginEditing 호출 후');
      };

      const createBlurHandler = (cell) => () => {
        endEditing(cell);
      };

      const createKeyDownHandler = (cell) => (event) => {
        // 편집 중인 셀이 아니면 무시
        if (!cell.classList.contains('cell-editing') && cell.contentEditable !== 'true') {
          return;
        }
        
        // 일반 텍스트 입력은 허용 (아무것도 하지 않음)
        if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          return; // 기본 동작 허용
        }
        
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          cell.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          // 원래 내용으로 복원
          const parser = new DOMParser();
          const doc = parser.parseFromString(savedHtmlContent, 'text/html');
          const originalTable = doc.querySelector('table');
          if (originalTable && tableRef.current) {
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
          cell.blur();
        }
      };

      cells.forEach((cell) => {
        const dblHandler = createDblClickHandler(cell);
        const blurHandler = createBlurHandler(cell);
        const keyDownHandler = createKeyDownHandler(cell);

        // 더블클릭은 캡처 단계에서 처리 (다른 이벤트보다 먼저)
        // 더블클릭은 버블링 단계에서도 처리 (확실하게)
        cell.addEventListener('dblclick', dblHandler, true);
        cell.addEventListener('dblclick', dblHandler, false);
        cell.addEventListener('blur', blurHandler, true);
        cell.addEventListener('keydown', keyDownHandler, true);

        eventBindings.push(
          { cell, type: 'dblclick', handler: dblHandler },
          { cell, type: 'blur', handler: blurHandler },
          { cell, type: 'keydown', handler: keyDownHandler },
        );
      });
      
      console.log(`이벤트 리스너 바인딩 완료: ${cells.length}개 셀`);
      
      // 테스트: 첫 번째 셀에 더블클릭 이벤트가 있는지 확인
      if (cells.length > 0) {
        const testCell = cells[0];
        // 실제로 더블클릭 이벤트를 테스트
        testCell.addEventListener('dblclick', () => {
          console.log('테스트: 첫 번째 셀 더블클릭 이벤트 작동!');
        }, { once: true });
      }
    };

    // 초기 설정 (약간의 지연 후 실행)
    const setupWithDelay = () => {
      setTimeout(() => {
        setupEventHandlers();
      }, 0);
      setTimeout(() => {
        setupEventHandlers();
      }, 100);
      setTimeout(() => {
        setupEventHandlers();
      }, 300);
    };
    
    setupWithDelay();

    // MutationObserver로 DOM 변경 감지하여 이벤트 재바인딩
    observer = new MutationObserver((mutations) => {
      // 편집 중인 셀이 있으면 재바인딩하지 않음
      if (editingCellRef.current) {
        console.log('편집 중인 셀이 있어서 재바인딩 스킵');
        return;
      }
      
      // childList 변경이 있을 때만 재바인딩
      const hasChildListChanges = mutations.some(m => m.type === 'childList');
      if (hasChildListChanges) {
        console.log('DOM 변경 감지, 이벤트 재바인딩');
        setTimeout(setupEventHandlers, 50);
      }
    });

    if (tableRef.current) {
      observer.observe(tableRef.current, {
        childList: true,
        subtree: true,
        attributes: false
      });
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
      
      eventBindings.forEach(({ cell, type, handler }) => {
        if (cell && cell.removeEventListener) {
          cell.removeEventListener(type, handler);
        }
      });
      
      if (tableRef.current) {
        const table = tableRef.current.querySelector('table');
        if (table) {
          const cells = table.querySelectorAll('td, th');
          cells.forEach((cell) => {
            cell.removeAttribute('contenteditable');
            cell.classList.remove('cell-editing');
          });
        }
      }
      editingCellRef.current = null;
    };
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
      
      const response = await fetch('http://localhost:8080/api/files/update-html', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordId: record.id,
          htmlContent: currentHtml,
        }),
      });

      if (!response.ok) {
        throw new Error('저장 실패');
      }

      // 편집 모드 종료 (먼저 종료)
      setIsEditing(false);
      
      // 업데이트 호출
      await onUpdate();
      
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
    
    // 더블클릭이면 아무것도 하지 않음 (더블클릭 이벤트가 발생하도록)
    if (e.detail >= 2) {
      console.log('handleMouseDown: 더블클릭 감지, 드래그 선택 안함');
      return;
    }
    
    if (cell && (cell.tagName === 'TD' || cell.tagName === 'TH')) {
      // contentEditable이 활성화된 셀은 드래그 선택 안함
      if (cell.contentEditable === 'true' || cell.classList.contains('cell-editing')) {
        console.log('handleMouseDown: 편집 중인 셀, 드래그 선택 안함');
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

  const handleMouseMove = (e) => {
    if (!isEditing || !isDragging || !startCellIndex) return;
    
    e.preventDefault();
    
    // 가로 스크롤 자동 이동
    if (tableRef.current) {
      const editorContent = tableRef.current.closest('.editor-content');
      if (editorContent) {
        const rect = editorContent.getBoundingClientRect();
        const mouseX = e.clientX;
        const scrollSpeed = 10;
        
        // 오른쪽 끝 근처에서 오른쪽으로 스크롤
        if (mouseX > rect.right - 50) {
          editorContent.scrollLeft += scrollSpeed;
        }
        // 왼쪽 끝 근처에서 왼쪽으로 스크롤
        else if (mouseX < rect.left + 50) {
          editorContent.scrollLeft -= scrollSpeed;
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
        setHtmlContent(tableRef.current.innerHTML);
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
      setHtmlContent(newHtml);
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
                  setHtmlContent(record.htmlContent);
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
        {isEditing ? (
          <div
            ref={tableRef}
            className="editable-table"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ userSelect: 'none' }}
          />
        ) : (
          <div
            className="preview-table"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
      </div>
    </div>
  );
};

export default HtmlEditor;

