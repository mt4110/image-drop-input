const headless = require('image-drop-input/headless');

const requiredFunctions = [
  'compressImage',
  'createMultipartUploader',
  'createPresignedPutUploader',
  'createRawPutUploader',
  'validateImage'
];

for (const name of requiredFunctions) {
  if (typeof headless[name] !== 'function') {
    throw new Error(`Expected headless ${name} export.`);
  }
}
