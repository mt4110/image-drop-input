import '../setup';
import type { ClipboardEvent, DragEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useImageDropInput } from '../../src/react/use-image-drop-input';

const { getImageMetadataMock } = vi.hoisted(() => ({
  getImageMetadataMock: vi.fn()
}));

vi.mock('../../src/core/get-image-metadata', () => ({
  getImageMetadata: getImageMetadataMock
}));

function createTransfer(...files: File[]): DataTransfer {
  return {
    dropEffect: 'copy',
    files,
    items: files.map((file) => ({
      kind: 'file',
      getAsFile: () => file
    }))
  } as unknown as DataTransfer;
}

describe('useImageDropInput', () => {
  beforeEach(() => {
    getImageMetadataMock.mockReset();
  });

  it('ignores non-image drop and paste payloads when accept is undefined', async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useImageDropInput({ onChange }));
    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const dropPreventDefault = vi.fn();
    const pastePreventDefault = vi.fn();

    await act(async () => {
      await result.current.handleDrop({
        preventDefault: dropPreventDefault,
        dataTransfer: createTransfer(textFile)
      } as unknown as DragEvent<HTMLElement>);
    });

    await act(async () => {
      await result.current.handlePaste({
        preventDefault: pastePreventDefault,
        clipboardData: createTransfer(textFile)
      } as unknown as ClipboardEvent<HTMLElement>);
    });

    expect(dropPreventDefault).toHaveBeenCalledTimes(1);
    expect(pastePreventDefault).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(getImageMetadataMock).not.toHaveBeenCalled();
  });
});
