const root = require('image-drop-input');
const headless = require('image-drop-input/headless');
const entrypointContract = require('../../scripts/package-entrypoint-contract.json');

const expectedRootExports = entrypointContract.rootExports;
const expectedHeadlessExports = entrypointContract.headlessExports;
const requiredRuntimeExports = entrypointContract.headlessRequiredRuntimeExports;

function assertExportSurface(entrypoint, actualExports, expectedExports) {
  const actualKeys = Object.keys(actualExports).sort();
  const expectedKeys = [...expectedExports].sort();

  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `Expected ${entrypoint} exports to match the packed package contract.\n` +
        `Expected: ${expectedKeys.join(', ')}\n` +
        `Received: ${actualKeys.join(', ')}`
    );
  }
}

assertExportSurface('root', root, expectedRootExports);
assertExportSurface('headless', headless, expectedHeadlessExports);

for (const name of requiredRuntimeExports) {
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
const persistableError = new headless.ImagePersistableValueError(
  'src_is_temporary',
  'Temporary image src cannot be persisted.',
  { field: 'src', srcProtocol: 'blob:' }
);
const localDraftError = new headless.LocalImageDraftError(
  'quota_exceeded',
  'Local draft storage quota was exceeded.',
  { mode: 'indexeddb', requestedBytes: 1024 }
);
const pipelineError = new headless.ImagePipelineError(
  'worker_unavailable',
  'Module workers are unavailable.',
  { mode: 'worker' }
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

if (!headless.isImagePipelineError(pipelineError)) {
  throw new Error('Expected headless isImagePipelineError to narrow ImagePipelineError.');
}

if (
  headless.deserializeImagePipelineError(
    headless.serializeImagePipelineError(pipelineError)
  ).code !== 'worker_unavailable'
) {
  throw new Error('Expected headless pipeline error serialization to preserve code.');
}

if (!headless.isImageDraftLifecycleError(lifecycleError)) {
  throw new Error('Expected headless isImageDraftLifecycleError to narrow ImageDraftLifecycleError.');
}

if (!headless.isImagePersistableValueError(persistableError)) {
  throw new Error('Expected headless isImagePersistableValueError to narrow ImagePersistableValueError.');
}

if (!headless.isLocalImageDraftError(localDraftError)) {
  throw new Error('Expected headless isLocalImageDraftError to narrow LocalImageDraftError.');
}

if (
  !headless.isLocalImageDraftManifest({
    version: 1,
    draftId: 'draft-1',
    fieldId: 'hero-image',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-08T00:00:00.000Z',
    phase: 'prepared'
  })
) {
  throw new Error('Expected headless isLocalImageDraftManifest to accept versioned manifest-like objects.');
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
