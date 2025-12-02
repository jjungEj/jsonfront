import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HtmlEditor from './HtmlEditor';

const sampleRecord = {
  id: 'rec-1',
  fileName: 'sample.html',
  originalTitle: 'sample.html',
  htmlContent: `
    <table>
      <tbody>
        <tr>
          <td>셀1</td>
          <td>셀2</td>
        </tr>
      </tbody>
    </table>
  `,
};

const multiTableRecord = {
  id: 'rec-2',
  fileName: 'multi.html',
  originalTitle: 'multi.html',
  htmlContent: `
    <table id="first-table">
      <tbody>
        <tr>
          <td>첫번째-1</td>
        </tr>
      </tbody>
    </table>
    <table id="second-table">
      <tbody>
        <tr>
          <td>두번째-1</td>
        </tr>
      </tbody>
    </table>
  `,
};

describe('HtmlEditor 셀 편집', () => {
  let rafSpy;
  let selectionMock;

  beforeEach(() => {
    jest.useFakeTimers();

    rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(cb, 0);
    });

    selectionMock = {
      rangeCount: 0,
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
    };

    window.getSelection = () => selectionMock;

    document.createRange = () => ({
      selectNodeContents: jest.fn(),
      collapse: jest.fn(),
      startContainer: { isConnected: true },
    });
  });

  afterEach(() => {
    rafSpy.mockRestore();
    jest.useRealTimers();
  });

  const enterEditMode = async (record = sampleRecord) => {
    render(<HtmlEditor record={record} onUpdate={jest.fn()} />);
    const editButton = await screen.findByRole('button', { name: '편집' });
    await userEvent.click(editButton);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  };

  it('더블 클릭 시 contenteditable 활성화', async () => {
    await enterEditMode();

    const cell = document.querySelector('.editable-table td');
    expect(cell).not.toBeNull();

    fireEvent.dblClick(cell);
    await act(async () => {
      jest.advanceTimersByTime(16);
    });

    expect(cell.getAttribute('contenteditable')).toBe('true');
  });

  it('두 번째 테이블 셀도 더블 클릭으로 편집 가능', async () => {
    await enterEditMode(multiTableRecord);

    const secondTableCell = document.querySelector('#second-table td');
    expect(secondTableCell).not.toBeNull();

    fireEvent.dblClick(secondTableCell);
    await act(async () => {
      jest.advanceTimersByTime(16);
    });

    expect(secondTableCell.getAttribute('contenteditable')).toBe('true');
  });
});

