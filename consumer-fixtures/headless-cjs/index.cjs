const headless = require('image-drop-input/headless');

const requiredFunctions = [
  'compressImage',
  'prepareImageToBudget',
  'ImageBudgetError',
  'isImageBudgetError',
  'createMultipartUploader',
  'createPresignedPutUploader',
  'createRawPutUploader',
  'ImageUploadError',
  'isImageUploadError',
  'ImagePersistableValueError',
  'toPersistableImageValue',
  'assertPersistableImageValue',
  'isPersistableImageValue',
  'isTemporaryImageSrc',
  'ImageDraftLifecycleError',
  'isImageDraftLifecycleError',
  'useImageDraftLifecycle',
  'validateImage'
];

for (const name of requiredFunctions) {
  if (typeof headless[name] !== 'function') {
    throw new Error(`Expected headless ${name} export.`);
  }
}

const uploadError = new headless.ImageUploadError(
  'network_error',
  'Upload failed due to a network error.',
  { stage: 'request', method: 'PUT' }
);
const budgetError = new headless.ImageBudgetError(
  'budget_unreachable',
  'Unable to prepare an image within the byte budget.',
  { outputMaxBytes: 1, attempts: [] }
);
const lifecycleError = new headless.ImageDraftLifecycleError(
  'missing_draft_key',
  'Draft uploads must return draftKey or key.',
  { phase: 'uploading-draft' }
);

if (!headless.isImageUploadError(uploadError)) {
  throw new Error('Expected headless isImageUploadError to narrow ImageUploadError.');
}

if (budgetError.name !== 'ImageBudgetError' || budgetError.code !== 'budget_unreachable') {
  throw new Error('Expected headless ImageBudgetError to expose stable error fields.');
}

if (!headless.isImageBudgetError(budgetError)) {
  throw new Error('Expected headless isImageBudgetError to narrow ImageBudgetError.');
}

if (!headless.isImageDraftLifecycleError(lifecycleError)) {
  throw new Error('Expected headless isImageDraftLifecycleError to narrow ImageDraftLifecycleError.');
}

const persistableValue = headless.toPersistableImageValue({
  src: 'https://cdn.example.com/avatar.webp',
  previewSrc: 'blob:preview'
});

if (persistableValue.previewSrc) {
  throw new Error('Expected previewSrc to be removed from persistable image values.');
}

if (!headless.isPersistableImageValue(persistableValue)) {
  throw new Error('Expected headless isPersistableImageValue to accept durable image values.');
}
