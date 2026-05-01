import '../setup';
import { useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useImageDropInput } from '../../src/react/use-image-drop-input';
import type { ImageUploadValue } from '../../src/core/types';
import { ImageUploadError } from '../../src/upload/errors';
import { createRawPutUploader } from '../../src/upload/create-raw-put-uploader';
import type { UploadAdapter } from '../../src/upload/types';

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

function createInputChange(file: File): ChangeEvent<HTMLInputElement> {
  return {
    target: {
      files: [file],
      value: 'selected'
    }
  } as unknown as ChangeEvent<HTMLInputElement>;
}

describe('useImageDropInput', () => {
  beforeEach(() => {
    getImageMetadataMock.mockReset();
    getImageMetadataMock.mockImplementation(async (file: Blob) => ({
      width: 1200,
      height: 900,
      size: file.size,
      mimeType: file.type
    }));

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:mock-object-url')
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    });
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

  it('releases an owned object URL when a controlled value replaces it', async () => {
    const onChange = vi.fn();
    const createObjectUrl = vi.mocked(URL.createObjectURL);
    const revokeObjectUrl = vi.mocked(URL.revokeObjectURL);

    createObjectUrl.mockReturnValue('blob:controlled-preview');

    function useControlledInput() {
      const [value, setValue] = useState<ImageUploadValue | null>(null);
      const input = useImageDropInput({
        value,
        onChange(nextValue) {
          onChange(nextValue);
          setValue(nextValue);
        }
      });

      return { input, setValue };
    }

    const { result } = renderHook(() => useControlledInput());

    await act(async () => {
      await result.current.input.handleInputChange(
        createInputChange(new File(['hello'], 'avatar.png', { type: 'image/png' }))
      );
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          previewSrc: 'blob:controlled-preview',
          fileName: 'avatar.png'
        })
      );
    });
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    act(() => {
      result.current.setValue({
        src: 'https://cdn.example.com/avatar.png',
        fileName: 'avatar.png'
      });
    });

    await waitFor(() => {
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:controlled-preview');
    });
  });

  it('cancels an in-flight upload without committing the draft value', async () => {
    const onChange = vi.fn();
    const onProgress = vi.fn();
    let uploadSignal: AbortSignal | undefined;
    const upload = vi.fn<UploadAdapter>((_file, context) => {
      uploadSignal = context.signal;
      context.onProgress?.(40);

      return new Promise<never>(() => {});
    });
    const { result } = renderHook(() => useImageDropInput({ upload, onChange, onProgress }));

    act(() => {
      void result.current.handleInputChange(
        createInputChange(new File(['hello'], 'avatar.png', { type: 'image/png' }))
      );
    });

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
      expect(result.current.isUploading).toBe(true);
      expect(result.current.progress).toBe(40);
    });

    act(() => {
      result.current.cancelUpload();
    });

    expect(uploadSignal?.aborted).toBe(true);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.displayValue).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-object-url');
  });

  it('discards an in-flight draft when a controlled value replaces it externally', async () => {
    const onChange = vi.fn();
    const createObjectUrl = vi.mocked(URL.createObjectURL);
    const revokeObjectUrl = vi.mocked(URL.revokeObjectURL);
    let uploadSignal: AbortSignal | undefined;
    const upload = vi.fn<UploadAdapter>((_file, context) => {
      uploadSignal = context.signal;

      return new Promise<never>(() => {});
    });

    createObjectUrl.mockReturnValue('blob:in-flight-controlled-preview');

    function useControlledInput() {
      const [value, setValue] = useState<ImageUploadValue | null>({
        src: 'https://cdn.example.com/existing.png',
        fileName: 'existing.png'
      });
      const input = useImageDropInput({
        value,
        onChange,
        upload
      });

      return { input, setValue };
    }

    const { result } = renderHook(() => useControlledInput());

    act(() => {
      void result.current.input.handleInputChange(
        createInputChange(new File(['hello'], 'avatar.png', { type: 'image/png' }))
      );
    });

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
      expect(result.current.input.displaySrc).toBe('blob:in-flight-controlled-preview');
    });

    act(() => {
      result.current.setValue({
        src: 'https://cdn.example.com/external.png',
        fileName: 'external.png'
      });
    });

    await waitFor(() => {
      expect(uploadSignal?.aborted).toBe(true);
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:in-flight-controlled-preview');
      expect(result.current.input.isUploading).toBe(false);
      expect(result.current.input.displaySrc).toBe('https://cdn.example.com/external.png');
    });

    expect(result.current.input.progress).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps upload completion state when controlled onChange normalizes the committed value', async () => {
    const onChange = vi.fn();
    const onProgress = vi.fn();
    const upload = vi.fn<UploadAdapter>((_file, context) => {
      context.onProgress?.(40);

      return Promise.resolve({
        src: 'https://cdn.example.com/avatar.png',
        key: 'avatars/avatar.png'
      });
    });

    function useControlledInput() {
      const [value, setValue] = useState<ImageUploadValue | null>(null);
      const input = useImageDropInput({
        value,
        upload,
        onProgress,
        onChange(nextValue) {
          onChange(nextValue);
          setValue(
            nextValue
              ? {
                  src: nextValue.src,
                  fileName: nextValue.fileName
                }
              : null
          );
        }
      });

      return input;
    }

    const { result } = renderHook(() => useControlledInput());

    await act(async () => {
      await result.current.handleInputChange(
        createInputChange(new File(['hello'], 'avatar.png', { type: 'image/png' }))
      );
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          src: 'https://cdn.example.com/avatar.png',
          key: 'avatars/avatar.png',
          fileName: 'avatar.png'
        })
      );
      expect(result.current.progress).toBe(100);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.displayValue).toEqual({
        src: 'https://cdn.example.com/avatar.png',
        fileName: 'avatar.png'
      });
    });

    expect(onProgress).toHaveBeenLastCalledWith(100);
  });

  it('ignores a pending transform when a controlled value replaces it externally', async () => {
    const onChange = vi.fn();
    const createObjectUrl = vi.mocked(URL.createObjectURL);
    let resolveTransform: ((file: File) => void) | undefined;
    const transform = vi.fn(
      () =>
        new Promise<File>((resolve) => {
          resolveTransform = resolve;
        })
    );

    function useControlledInput() {
      const [value, setValue] = useState<ImageUploadValue | null>({
        src: 'https://cdn.example.com/existing.png',
        fileName: 'existing.png'
      });
      const input = useImageDropInput({
        value,
        onChange,
        transform
      });

      return { input, setValue };
    }

    const { result } = renderHook(() => useControlledInput());

    act(() => {
      void result.current.input.handleInputChange(
        createInputChange(new File(['hello'], 'avatar.png', { type: 'image/png' }))
      );
    });

    await waitFor(() => {
      expect(transform).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.setValue({
        src: 'https://cdn.example.com/external.png',
        fileName: 'external.png'
      });
    });

    await act(async () => {
      resolveTransform?.(new File(['prepared'], 'avatar.webp', { type: 'image/webp' }));
      await Promise.resolve();
    });

    expect(result.current.input.displaySrc).toBe('https://cdn.example.com/external.png');
    expect(onChange).not.toHaveBeenCalled();
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it('retries a failed upload with the prepared file without rerunning transform', async () => {
    const onChange = vi.fn();
    const preparedFile = new File(['prepared'], 'avatar.webp', { type: 'image/webp' });
    const transform = vi.fn(async () => preparedFile);
    let attempt = 0;
    const upload = vi.fn<UploadAdapter>(async () => {
      attempt += 1;

      if (attempt === 1) {
        throw new Error('Upload failed.');
      }

      return {
        src: 'https://cdn.example.com/avatar.webp',
        key: 'avatars/avatar.webp'
      };
    });
    const { result } = renderHook(() => useImageDropInput({ upload, transform, onChange }));

    await act(async () => {
      await result.current.handleInputChange(
        createInputChange(new File(['hello'], 'avatar.png', { type: 'image/png' }))
      );
    });

    expect(result.current.error?.message).toBe('Upload failed.');
    expect(result.current.canRetryUpload).toBe(true);

    act(() => {
      result.current.retryUpload();
    });

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          src: 'https://cdn.example.com/avatar.webp',
          key: 'avatars/avatar.webp',
          fileName: 'avatar.webp'
        })
      );
    });

    expect(transform).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]?.[0]).toBe(preparedFile);
    expect(upload.mock.calls[1]?.[0]).toBe(preparedFile);
  });

  it('passes structured errors from built-in upload helpers to onError', async () => {
    const onError = vi.fn();
    const uploadError = new ImageUploadError(
      'http_error',
      'Upload failed: 413 Payload Too Large',
      {
        stage: 'request',
        method: 'PUT',
        status: 413,
        statusText: 'Payload Too Large'
      }
    );
    const request = vi.fn(async () => {
      throw uploadError;
    });
    const upload = createRawPutUploader({
      endpoint: '/api/avatar',
      request
    });
    const { result } = renderHook(() => useImageDropInput({ upload, onError }));

    await act(async () => {
      await result.current.handleInputChange(
        createInputChange(new File(['hello'], 'avatar.png', { type: 'image/png' }))
      );
    });

    expect(onError).toHaveBeenCalledWith(uploadError);
    expect(result.current.error).toBe(uploadError);
    expect(result.current.canRetryUpload).toBe(true);
  });

  it('normalizes object transform metadata for upload context and the final value', async () => {
    const onChange = vi.fn();
    const transformedBlob = new Blob(['encoded'], { type: 'application/octet-stream' });
    const transform = vi.fn(() => ({
      file: transformedBlob,
      fileName: 'avatar-custom.webp',
      mimeType: 'image/webp'
    }));
    const upload = vi.fn<UploadAdapter>(async () => ({
      key: 'avatars/avatar-custom.webp'
    }));
    const { result } = renderHook(() => useImageDropInput({ upload, transform, onChange }));

    await act(async () => {
      await result.current.handleInputChange(
        createInputChange(new File(['source'], 'avatar.png', { type: 'image/png' }))
      );
    });

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          key: 'avatars/avatar-custom.webp',
          previewSrc: 'blob:mock-object-url',
          fileName: 'avatar-custom.webp',
          mimeType: 'image/webp',
          size: transformedBlob.size,
          width: 1200,
          height: 900
        })
      );
    });

    const uploadedFile = upload.mock.calls[0]?.[0] as File | undefined;
    const uploadContext = upload.mock.calls[0]?.[1];

    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile?.name).toBe('avatar-custom.webp');
    expect(uploadedFile?.type).toBe('image/webp');
    expect(uploadContext).toMatchObject({
      fileName: 'avatar-custom.webp',
      originalFileName: 'avatar.png',
      mimeType: 'image/webp'
    });
  });

  it('aborts in-flight upload and revokes owned object URLs on unmount', async () => {
    const createObjectUrl = vi.mocked(URL.createObjectURL);
    const revokeObjectUrl = vi.mocked(URL.revokeObjectURL);
    let uploadSignal: AbortSignal | undefined;
    const upload = vi.fn<UploadAdapter>((_file, context) => {
      uploadSignal = context.signal;

      return new Promise<never>(() => {});
    });

    createObjectUrl.mockReturnValue('blob:in-flight-preview');

    const { result, unmount } = renderHook(() => useImageDropInput({ upload }));

    act(() => {
      void result.current.handleInputChange(
        createInputChange(new File(['hello'], 'avatar.png', { type: 'image/png' }))
      );
    });

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
    });

    act(() => {
      unmount();
    });

    expect(uploadSignal?.aborted).toBe(true);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:in-flight-preview');
  });
});
