const headless = require('image-drop-input/headless');

const requiredFunctions = [
  'compressImage',
  'createMultipartUploader',
  'createPresignedPutUploader',
  'createRawPutUploader',
  'ImageUploadError',
  'isImageUploadError',
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
