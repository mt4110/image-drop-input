import './setup';
import { describe, expect, it } from 'vitest';
import * as headless from '../src/headless';
import * as root from '../src/index';

describe('package entrypoints', () => {
  it('keeps advanced utilities off the root entry', () => {
    expect(root).toHaveProperty('ImageDropInput');
    expect(root.isImageValidationError).toBeTypeOf('function');
    expect(root).not.toHaveProperty('compressImage');
    expect(root).not.toHaveProperty('createPresignedPutUploader');
    expect(root).not.toHaveProperty('useImageDropInput');
    expect(root).not.toHaveProperty('validateImage');
  });

  it('keeps advanced utilities available from the headless entry', () => {
    expect(headless.compressImage).toBeTypeOf('function');
    expect(headless.createPresignedPutUploader).toBeTypeOf('function');
    expect(headless.ImageValidationError).toBeTypeOf('function');
    expect(headless.isImageValidationError).toBeTypeOf('function');
    expect(headless.useImageDropInput).toBeTypeOf('function');
    expect(headless.validateImage).toBeTypeOf('function');
  });
});
