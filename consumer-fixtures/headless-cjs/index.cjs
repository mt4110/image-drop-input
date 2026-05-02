const headless = require('image-drop-input/headless');

const requiredFunctions = [
  'compressImage',
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

if (!headless.isImageUploadError(uploadError)) {
  throw new Error('Expected headless isImageUploadError to narrow ImageUploadError.');
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
