import './setup';
import { describe, expect, it } from 'vitest';
import * as headless from '../src/headless';
import * as root from '../src/index';

describe('package entrypoints', () => {
  it('keeps advanced helper utilities off the root entry', () => {
    expect(root).toHaveProperty('ImageDropInput');
    expect(root.isImageValidationError).toBeTypeOf('function');
    expect(root.ImageUploadError).toBeTypeOf('function');
    expect(root.isImageUploadError).toBeTypeOf('function');
    expect(root.ImagePersistableValueError).toBeTypeOf('function');
    expect(root.toPersistableImageValue).toBeTypeOf('function');
    expect(root.assertPersistableImageValue).toBeTypeOf('function');
    expect(root.isPersistableImageValue).toBeTypeOf('function');
    expect(root.isTemporaryImageSrc).toBeTypeOf('function');
    expect(root).not.toHaveProperty('compressImage');
    expect(root).not.toHaveProperty('ImageBudgetError');
    expect(root).not.toHaveProperty('isImageBudgetError');
    expect(root).not.toHaveProperty('prepareImageToBudget');
    expect(root).not.toHaveProperty('ImageDraftLifecycleError');
    expect(root).not.toHaveProperty('isImageDraftLifecycleError');
    expect(root).not.toHaveProperty('useImageDraftLifecycle');
    expect(root).not.toHaveProperty('createPresignedPutUploader');
    expect(root).not.toHaveProperty('useImageDropInput');
    expect(root).not.toHaveProperty('validateImage');
  });

  it('keeps advanced utilities available from the headless entry', () => {
    expect(headless.compressImage).toBeTypeOf('function');
    expect(headless.prepareImageToBudget).toBeTypeOf('function');
    expect(headless.ImageBudgetError).toBeTypeOf('function');
    expect(headless.isImageBudgetError).toBeTypeOf('function');
    expect(headless.createPresignedPutUploader).toBeTypeOf('function');
    expect(headless.ImageValidationError).toBeTypeOf('function');
    expect(headless.isImageValidationError).toBeTypeOf('function');
    expect(headless.ImageUploadError).toBeTypeOf('function');
    expect(headless.isImageUploadError).toBeTypeOf('function');
    expect(headless.ImagePersistableValueError).toBeTypeOf('function');
    expect(headless.toPersistableImageValue).toBeTypeOf('function');
    expect(headless.assertPersistableImageValue).toBeTypeOf('function');
    expect(headless.isPersistableImageValue).toBeTypeOf('function');
    expect(headless.isTemporaryImageSrc).toBeTypeOf('function');
    expect(headless.ImageDraftLifecycleError).toBeTypeOf('function');
    expect(headless.isImageDraftLifecycleError).toBeTypeOf('function');
    expect(headless.useImageDropInput).toBeTypeOf('function');
    expect(headless.useImageDraftLifecycle).toBeTypeOf('function');
    expect(headless.validateImage).toBeTypeOf('function');
  });
});
