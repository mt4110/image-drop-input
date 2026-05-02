const headless = require('image-drop-input/headless');

const requiredFunctions = [
  'compressImage',
  'prepareImageToBudget',
  'ImageBudgetError',
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

if (!headless.isImageUploadError(uploadError)) {
  throw new Error('Expected headless isImageUploadError to narrow ImageUploadError.');
}

if (budgetError.name !== 'ImageBudgetError' || budgetError.code !== 'budget_unreachable') {
  throw new Error('Expected headless ImageBudgetError to expose stable error fields.');
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
