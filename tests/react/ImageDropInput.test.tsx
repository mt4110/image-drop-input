import '../setup';
import type { CSSProperties } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageDropInput } from '../../src/react/ImageDropInput';

vi.mock('../../src/core/get-image-metadata', () => ({
  getImageMetadata: vi.fn(async (file: Blob) => ({
    width: 1200,
    height: 900,
    size: file.size,
    mimeType: file.type
  }))
}));

describe('ImageDropInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn()
        .mockReturnValueOnce('blob:preview-url')
        .mockReturnValueOnce('blob:first-preview')
        .mockReturnValueOnce('blob:second-preview')
        .mockReturnValue('blob:preview-url')
    });
  });

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

  it('keeps the hidden file input out of tab order and exposes the dropzone as the focus target', async () => {
    const user = userEvent.setup({ document: window.document });
    const { container } = render(<ImageDropInput />);

    const input = container.querySelector('.idi-input') as HTMLInputElement | null;
    const dropzone = screen.getByRole('button', { name: 'Image upload area' });

    expect(input).not.toBeNull();

    if (!input) {
      throw new Error('Expected hidden file input.');
    }

    expect(input.tabIndex).toBe(-1);
    expect(input.getAttribute('aria-hidden')).toBe('true');

    await user.tab();

    expect(document.activeElement).toBe(dropzone);
  });

  it('keeps the default idle footer visually quiet until there is something actionable to show', () => {
    render(<ImageDropInput />);

    expect(screen.queryByText('Drop, browse, or paste.')).toBeNull();
  });

  it('keeps the default filled state focused on the image instead of repeating the filename in the footer', () => {
    render(
      <ImageDropInput
        value={{
          src: 'https://cdn.example.com/avatar.png',
          fileName: 'avatar.png'
        }}
      />
    );

    expect(screen.queryByText('avatar.png')).toBeNull();
  });

  it('still renders a custom footer even before an image is selected', () => {
    render(
      <ImageDropInput
        renderFooter={({ statusMessage }) => <div data-testid="custom-footer">{statusMessage}</div>}
      />
    );

    expect(screen.getByTestId('custom-footer').textContent).toBe('Drop, browse, or paste.');
  });

  it('shows a local preview first and then swaps in the uploaded URL', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();
    const upload = vi.fn(async (_file: Blob, context: { onProgress?: (percent: number) => void }) => {
      context.onProgress?.(45);
      context.onProgress?.(100);

      return {
        src: 'https://cdn.example.com/avatar.png',
        key: 'avatars/avatar.png'
      };
    });

    render(<ImageDropInput upload={upload} onChange={onChange} />);

    const input = screen.getByLabelText('Choose image file');
    const file = new File(['hello'], 'avatar.png', { type: 'image/png' });

    await user.upload(input, file);

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          src: 'https://cdn.example.com/avatar.png',
          key: 'avatars/avatar.png',
          fileName: 'avatar.png'
        })
      );
    });

    expect(screen.getByAltText('Selected image preview').getAttribute('src')).toBe(
      'https://cdn.example.com/avatar.png'
    );
  });

  it('guarantees external upload progress reaches 100 on success', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();
    const onProgress = vi.fn();
    const upload = vi.fn(async (_file: Blob, context: { onProgress?: (percent: number) => void }) => {
      context.onProgress?.(45);

      return {
        src: 'https://cdn.example.com/avatar.png'
      };
    });

    render(<ImageDropInput upload={upload} onChange={onChange} onProgress={onProgress} />);

    await user.upload(
      screen.getByLabelText('Choose image file'),
      new File(['hello'], 'avatar.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          src: 'https://cdn.example.com/avatar.png'
        })
      );
    });

    expect(onProgress.mock.calls.map(([percent]) => percent)).toEqual([45, 100]);
  });

  it('does not duplicate the final external progress event when the adapter already reported 100', async () => {
    const user = userEvent.setup({ document: window.document });
    const onProgress = vi.fn();
    const upload = vi.fn(async (_file: Blob, context: { onProgress?: (percent: number) => void }) => {
      context.onProgress?.(45);
      context.onProgress?.(100);

      return {
        src: 'https://cdn.example.com/avatar.png'
      };
    });

    render(<ImageDropInput upload={upload} onProgress={onProgress} />);

    await user.upload(
      screen.getByLabelText('Choose image file'),
      new File(['hello'], 'avatar.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
    });

    expect(onProgress.mock.calls.map(([percent]) => percent)).toEqual([45, 100]);
  });

  it('keeps previewSrc separate when upload finishes without a persisted src', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();
    const upload = vi.fn(async () => ({
      key: 'avatars/avatar.png'
    }));

    render(<ImageDropInput upload={upload} onChange={onChange} />);

    const input = screen.getByLabelText('Choose image file');
    const file = new File(['hello'], 'avatar.png', { type: 'image/png' });

    await user.upload(input, file);

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          key: 'avatars/avatar.png',
          previewSrc: 'blob:preview-url',
          fileName: 'avatar.png'
        })
      );
    });

    const nextValue = onChange.mock.lastCall?.[0] as { previewSrc?: string; src?: string } | undefined;

    expect(nextValue?.src).toBeUndefined();
    expect(screen.getByAltText('Selected image preview').getAttribute('src')).toBe('blob:preview-url');
  });

  it('reverts to the last committed value when an upload fails', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();
    let rejectUpload: ((error: Error) => void) | undefined;
    const upload = vi.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          rejectUpload = reject;
        })
    );

    render(
      <ImageDropInput
        value={{
          src: 'https://cdn.example.com/existing.png',
          fileName: 'existing.png'
        }}
        upload={upload}
        onChange={onChange}
      />
    );

    const input = screen.getByLabelText('Choose image file');
    const file = new File(['hello'], 'avatar.png', { type: 'image/png' });

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByAltText('Selected image preview').getAttribute('src')).toBe('blob:preview-url');
    });

    rejectUpload?.(new Error('Upload failed.'));

    await waitFor(() => {
      expect(screen.getByAltText('Selected image preview').getAttribute('src')).toBe(
        'https://cdn.example.com/existing.png'
      );
    });

    expect(screen.getByRole('alert').textContent).toContain('Upload failed.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-url');
  });

  it('retries a failed upload from the dedicated error action', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();
    const preparedFile = new File(['prepared'], 'avatar.webp', { type: 'image/webp' });
    const transform = vi.fn(async () => preparedFile);
    let attempt = 0;
    const upload = vi.fn(async (_file: Blob) => {
      attempt += 1;

      if (attempt === 1) {
        throw new Error('Upload failed.');
      }

      return {
        src: 'https://cdn.example.com/avatar.png',
        key: 'avatars/avatar.png'
      };
    });

    render(<ImageDropInput upload={upload} transform={transform} onChange={onChange} />);

    await user.upload(
      screen.getByLabelText('Choose image file'),
      new File(['hello'], 'avatar.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(2);
      expect(transform).toHaveBeenCalledTimes(1);
      expect(upload.mock.calls[0]?.[0]).toBe(preparedFile);
      expect(upload.mock.calls[1]?.[0]).toBe(preparedFile);
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          src: 'https://cdn.example.com/avatar.png',
          key: 'avatars/avatar.png',
          fileName: 'avatar.webp'
        })
      );
    });
  });

  it('ignores stale upload results when a newer file replaces the current run', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn()
        .mockReturnValueOnce('blob:first-preview')
        .mockReturnValueOnce('blob:second-preview')
    });
    const pending = new Map<string, (value: { src: string; key: string }) => void>();
    const upload = vi.fn(
      (file: Blob) =>
        new Promise<{ src: string; key: string }>((resolve) => {
          pending.set((file as File).name, resolve);
        })
    );

    render(<ImageDropInput upload={upload} onChange={onChange} />);

    const input = screen.getByLabelText('Choose image file');

    await user.upload(input, new File(['first'], 'first.png', { type: 'image/png' }));
    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
    });

    await user.upload(input, new File(['second'], 'second.png', { type: 'image/png' }));
    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(2);
    });

    pending.get('first.png')?.({
      src: 'https://cdn.example.com/first.png',
      key: 'avatars/first.png'
    });

    await waitFor(() => {
      expect(screen.getByAltText('Selected image preview').getAttribute('src')).toBe('blob:second-preview');
    });
    expect(onChange).not.toHaveBeenCalled();

    pending.get('second.png')?.({
      src: 'https://cdn.example.com/second.png',
      key: 'avatars/second.png'
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          src: 'https://cdn.example.com/second.png',
          key: 'avatars/second.png',
          fileName: 'second.png'
        })
      );
    });
  });

  it('keeps the original filename when transform returns a plain Blob', async () => {
    const user = userEvent.setup({ document: window.document });
    const upload = vi.fn<
      (
        file: Blob,
        context: { fileName?: string; originalFileName?: string; mimeType?: string }
      ) => Promise<{ src: string }>
    >(async () => ({
      src: 'https://cdn.example.com/avatar.png'
    }));

    render(
      <ImageDropInput
        upload={upload}
        transform={() => new Blob(['compressed'], { type: 'image/png' })}
      />
    );

    const input = screen.getByLabelText('Choose image file');
    const file = new File(['hello'], 'avatar.png', { type: 'image/png' });

    await user.upload(input, file);

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
    });

    const firstCall = upload.mock.calls[0];

    expect(firstCall).toBeDefined();

    if (!firstCall) {
      throw new Error('Expected upload to be called.');
    }

    const uploadedFile = firstCall[0] as File;
    const uploadContext = firstCall[1];

    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.name).toBe('avatar.png');
    expect(uploadContext).toMatchObject({
      fileName: 'avatar.png',
      originalFileName: 'avatar.png',
      mimeType: 'image/png'
    });
  });

  it('keeps maxBytes as a source and transformed output limit for compatibility', async () => {
    const user = userEvent.setup({ document: window.document });
    const onError = vi.fn();
    const transform = vi.fn(() => new File(['ok'], 'avatar.webp', { type: 'image/webp' }));

    render(<ImageDropInput maxBytes={2} transform={transform} onError={onError} />);

    await user.upload(
      screen.getByLabelText('Choose image file'),
      new File(['hello'], 'avatar.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Select an image smaller than 2 B.');
    });

    expect(transform).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'file_too_large',
        details: expect.objectContaining({
          actualBytes: 5,
          maxBytes: 2
        })
      })
    );
  });

  it('allows outputMaxBytes to limit the transformed file without rejecting a larger source', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();
    const transformedFile = new File(['ok'], 'avatar.webp', { type: 'image/webp' });
    const transform = vi.fn(() => transformedFile);

    render(
      <ImageDropInput
        outputMaxBytes={3}
        transform={transform}
        onChange={onChange}
      />
    );

    await user.upload(
      screen.getByLabelText('Choose image file'),
      new File(['large source'], 'avatar.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(transform).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'avatar.webp',
          size: transformedFile.size
        })
      );
    });
  });

  it('rejects transformed files that exceed outputMaxBytes', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();
    const onError = vi.fn();
    const transform = vi.fn(() => new File(['still too large'], 'avatar.webp', { type: 'image/webp' }));

    render(
      <ImageDropInput
        inputMaxBytes={20}
        outputMaxBytes={2}
        transform={transform}
        onChange={onChange}
        onError={onError}
      />
    );

    await user.upload(
      screen.getByLabelText('Choose image file'),
      new File(['source'], 'avatar.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'file_too_large',
          details: expect.objectContaining({
            maxBytes: 2
          })
        })
      );
    });

    expect(transform).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not let disabled action buttons mutate state', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();

    render(
      <ImageDropInput
        disabled
        zoomable
        value={{
          src: 'https://cdn.example.com/avatar.png',
          fileName: 'avatar.png'
        }}
        onChange={onChange}
      />
    );

    const previewButton = screen.getByLabelText('Open preview') as HTMLButtonElement;
    const replaceButton = screen.getByLabelText('Replace image') as HTMLButtonElement;
    const removeButton = screen.getByLabelText('Remove image') as HTMLButtonElement;

    expect(previewButton.disabled).toBe(true);
    expect(replaceButton.disabled).toBe(true);
    expect(removeButton.disabled).toBe(true);

    await user.click(removeButton);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByAltText('Selected image preview').getAttribute('src')).toBe(
      'https://cdn.example.com/avatar.png'
    );
  });

  it('stays visually controlled until the parent updates value', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();

    render(
      <ImageDropInput
        value={{
          src: 'https://cdn.example.com/avatar.png',
          fileName: 'avatar.png'
        }}
        onChange={onChange}
      />
    );

    await user.click(screen.getByLabelText('Remove image'));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByAltText('Selected image preview').getAttribute('src')).toBe(
      'https://cdn.example.com/avatar.png'
    );
  });

  it('lets consumers customize copy and internal class names', () => {
    const { container } = render(
      <ImageDropInput
        classNames={{
          root: 'custom-root',
          dropzone: 'custom-dropzone',
          placeholderTitle: 'custom-placeholder-title'
        }}
        messages={{
          chooseFile: 'Select image',
          dropzoneLabelEmpty: 'Upload surface',
          placeholderTitle: 'Bring your image',
          placeholderDescription: 'Drop, browse, or paste'
        }}
      />
    );

    expect(screen.getByLabelText('Select image')).toBeTruthy();
    expect(screen.getByLabelText('Upload surface')).toBeTruthy();
    expect(screen.getByText('Bring your image').className).toContain('custom-placeholder-title');
    expect(screen.getByText('Drop, browse, or paste')).toBeTruthy();
    expect(container.querySelector('.custom-root')).not.toBeNull();
    expect(container.querySelector('.custom-dropzone')).not.toBeNull();
  });

  it('keeps inline CSS variables on the root while leaving layout styles on the dropzone', () => {
    const { container } = render(
      <ImageDropInput
        style={
          {
            '--idi-accent': '#123456',
            minHeight: '22rem'
          } as CSSProperties
        }
      />
    );

    const root = container.querySelector('.idi-root') as HTMLDivElement | null;
    const dropzone = container.querySelector('.idi-dropzone') as HTMLDivElement | null;

    expect(root).not.toBeNull();
    expect(dropzone).not.toBeNull();

    if (!root || !dropzone) {
      throw new Error('Expected root and dropzone elements.');
    }

    expect(root.style.getPropertyValue('--idi-accent')).toBe('#123456');
    expect(dropzone.style.getPropertyValue('--idi-accent')).toBe('');
    expect(dropzone.style.minHeight).toBe('22rem');
  });

  it('treats the filled dropzone as a focusable button and keeps pointer replacement explicit', async () => {
    const user = userEvent.setup({ document: window.document });
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

    render(
      <ImageDropInput
        value={{
          src: 'https://cdn.example.com/avatar.png',
          fileName: 'avatar.png'
        }}
      />
    );

    const dropzone = screen.getByRole('button', { name: 'Selected image' });

    expect(screen.queryByRole('group', { name: 'Selected image' })).toBeNull();
    expect(dropzone.tabIndex).toBe(0);
    expect(dropzone.getAttribute('aria-keyshortcuts')).toBe('Enter Space Delete Backspace');

    await user.click(dropzone);
    expect(inputClickSpy).not.toHaveBeenCalled();

    dropzone.focus();
    await user.keyboard('{Enter}');
    expect(inputClickSpy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText('Replace image'));
    expect(inputClickSpy).toHaveBeenCalledTimes(2);
  });

  it('removes the selected image from the focused filled dropzone with Delete or Backspace', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();

    render(
      <ImageDropInput
        value={{
          src: 'https://cdn.example.com/avatar.png',
          fileName: 'avatar.png'
        }}
        onChange={onChange}
      />
    );

    const dropzone = screen.getByRole('button', { name: 'Selected image' });

    dropzone.focus();
    await user.keyboard('{Delete}');

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('does not enter drag state or accept drops while disabled', async () => {
    const upload = vi.fn(async () => ({
      src: 'https://cdn.example.com/avatar.png'
    }));

    render(<ImageDropInput disabled upload={upload} />);

    const dropzone = screen.getByRole('button', { name: 'Image upload area' });
    const file = new File(['hello'], 'avatar.png', { type: 'image/png' });

    fireEvent.dragOver(dropzone, { dataTransfer: createTransfer(file) });
    expect(dropzone.getAttribute('data-dragging')).toBe('false');

    fireEvent.drop(dropzone, { dataTransfer: createTransfer(file) });

    await waitFor(() => {
      expect(upload).not.toHaveBeenCalled();
    });
  });

  it('accepts pasted images from the clipboard', async () => {
    const onChange = vi.fn();

    render(<ImageDropInput onChange={onChange} />);

    const dropzone = screen.getByRole('button', { name: 'Image upload area' });
    const file = new File(['hello'], 'pasted.png', { type: 'image/png' });

    fireEvent.paste(dropzone, { clipboardData: createTransfer(file) });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          previewSrc: 'blob:preview-url',
          fileName: 'pasted.png'
        })
      );
    });

    const nextValue = onChange.mock.lastCall?.[0] as { previewSrc?: string; src?: string } | undefined;

    expect(nextValue?.src).toBeUndefined();
  });

  it('replaces the selected image when an image is pasted into the focused filled dropzone', async () => {
    const onChange = vi.fn();

    render(
      <ImageDropInput
        value={{
          src: 'https://cdn.example.com/avatar.png',
          fileName: 'avatar.png'
        }}
        onChange={onChange}
      />
    );

    const dropzone = screen.getByRole('button', { name: 'Selected image' });
    const file = new File(['hello'], 'pasted.png', { type: 'image/png' });

    dropzone.focus();
    fireEvent.paste(dropzone, { clipboardData: createTransfer(file) });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          previewSrc: 'blob:preview-url',
          fileName: 'pasted.png'
        })
      );
    });
  });

  it('keeps local-only selections in previewSrc so src stays reserved for persisted references', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();

    render(<ImageDropInput onChange={onChange} />);

    await user.upload(
      screen.getByLabelText('Choose image file'),
      new File(['hello'], 'avatar.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          previewSrc: 'blob:preview-url',
          fileName: 'avatar.png'
        })
      );
    });

    const nextValue = onChange.mock.lastCall?.[0] as { previewSrc?: string; src?: string } | undefined;

    expect(nextValue?.src).toBeUndefined();
    expect(screen.getByAltText('Selected image preview').getAttribute('src')).toBe('blob:preview-url');
  });

  it('traps focus in the preview dialog and restores focus on Escape', async () => {
    const user = userEvent.setup({ document: window.document });

    render(
      <>
        <button type="button">Outside</button>
        <ImageDropInput
          value={{
            src: 'https://cdn.example.com/avatar.png',
            fileName: 'avatar.png'
          }}
        />
      </>
    );

    const previewButton = screen.getByLabelText('Open preview');

    await user.click(previewButton);

    const closeButton = await screen.findByLabelText('Close preview');

    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton);
    });

    await user.tab();
    expect(document.activeElement).toBe(closeButton);

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Image preview' })).toBeNull();
    });

    expect(document.activeElement).toBe(previewButton);
  });

  it('closes the preview dialog when the backdrop is clicked', async () => {
    const user = userEvent.setup({ document: window.document });
    const { container } = render(
      <ImageDropInput
        value={{
          src: 'https://cdn.example.com/avatar.png',
          fileName: 'avatar.png'
        }}
      />
    );

    await user.click(screen.getByLabelText('Open preview'));

    const overlay = container.querySelector('.idi-dialogOverlay') as HTMLDivElement | null;

    expect(overlay).not.toBeNull();

    if (!overlay) {
      throw new Error('Expected preview overlay.');
    }

    await user.click(overlay);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Image preview' })).toBeNull();
    });
  });

  it('does not reopen a stale preview dialog after the image value is cleared', async () => {
    const user = userEvent.setup({ document: window.document });
    const { rerender } = render(
      <ImageDropInput
        value={{
          src: 'https://cdn.example.com/avatar.png',
          fileName: 'avatar.png'
        }}
      />
    );

    await user.click(screen.getByLabelText('Open preview'));
    expect(await screen.findByRole('dialog', { name: 'Image preview' })).toBeTruthy();

    rerender(<ImageDropInput value={null} />);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Image preview' })).toBeNull();
    });

    rerender(
      <ImageDropInput
        value={{
          src: 'https://cdn.example.com/new-avatar.png',
          fileName: 'new-avatar.png'
        }}
      />
    );

    expect(screen.queryByRole('dialog', { name: 'Image preview' })).toBeNull();
  });

  it('keeps custom preview actions inert when previewable is disabled', async () => {
    const user = userEvent.setup({ document: window.document });

    render(
      <ImageDropInput
        previewable={false}
        value={{
          src: 'https://cdn.example.com/avatar.png',
          fileName: 'avatar.png'
        }}
        renderActions={({ openPreview }) => (
          <button type="button" aria-label="Custom preview" onClick={openPreview}>
            Preview
          </button>
        )}
      />
    );

    await user.click(screen.getByLabelText('Custom preview'));

    expect(screen.queryByRole('dialog', { name: 'Image preview' })).toBeNull();
  });

  it('revokes object URLs when a local preview unmounts', async () => {
    const user = userEvent.setup({ document: window.document });
    const { unmount } = render(<ImageDropInput />);

    await user.upload(
      screen.getByLabelText('Choose image file'),
      new File(['hello'], 'avatar.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(screen.getByAltText('Selected image preview').getAttribute('src')).toBe('blob:preview-url');
    });

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-url');
  });

  it('supports render prop customization without forking the component', async () => {
    const user = userEvent.setup({ document: window.document });
    const onChange = vi.fn();

    const { rerender } = render(
      <ImageDropInput
        renderPlaceholder={({ messages, openFileDialog }) => (
          <button type="button" onClick={openFileDialog}>
            {messages.placeholderTitle} / custom
          </button>
        )}
      />
    );

    expect(screen.getByRole('button', { name: 'Drop image or browse / custom' })).toBeTruthy();

    rerender(
      <ImageDropInput
        value={{
          src: 'https://cdn.example.com/avatar.png',
          fileName: 'avatar.png'
        }}
        onChange={onChange}
        renderActions={({ removeValue }) => (
          <button type="button" aria-label="Custom remove" onClick={removeValue}>
            Remove
          </button>
        )}
        renderFooter={({ displayValue, statusMessage }) => (
          <div>
            {displayValue?.fileName} / {statusMessage}
          </div>
        )}
      />
    );

    expect(screen.getByText('avatar.png / avatar.png')).toBeTruthy();

    await user.click(screen.getByLabelText('Custom remove'));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('absorbs custom action and footer interactions so they do not reopen the picker', async () => {
    const user = userEvent.setup({ document: window.document });
    const actionClick = vi.fn();
    const footerClick = vi.fn();
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

    render(
      <ImageDropInput
        renderActions={() => (
          <button type="button" aria-label="Custom action" onClick={actionClick}>
            Action
          </button>
        )}
        renderFooter={() => (
          <button type="button" aria-label="Custom footer" onClick={footerClick}>
            Footer
          </button>
        )}
      />
    );

    const customAction = screen.getByLabelText('Custom action');

    customAction.focus();
    await user.keyboard('{Enter}');

    expect(actionClick).toHaveBeenCalledTimes(1);
    expect(inputClickSpy).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText('Custom footer'));

    expect(footerClick).toHaveBeenCalledTimes(1);
    expect(inputClickSpy).not.toHaveBeenCalled();
  });

  it('shows an explicit validation error when a non-image archive is dropped', async () => {
    const onChange = vi.fn();

    render(<ImageDropInput onChange={onChange} />);

    const dropzone = screen.getByRole('button', { name: 'Image upload area' });
    const file = new File(['hello'], 'archive.zip', { type: 'application/zip' });

    fireEvent.drop(dropzone, { dataTransfer: createTransfer(file) });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Accepted file types: image files.');
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('prefers an acceptable image when mixed files are dropped together', async () => {
    const onChange = vi.fn();

    render(<ImageDropInput onChange={onChange} accept="image/png" />);

    const dropzone = screen.getByRole('button', { name: 'Image upload area' });
    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const pngFile = new File(['hello'], 'photo.png', { type: 'image/png' });

    fireEvent.drop(dropzone, { dataTransfer: createTransfer(textFile, pngFile) });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          previewSrc: 'blob:preview-url',
          fileName: 'photo.png'
        })
      );
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
