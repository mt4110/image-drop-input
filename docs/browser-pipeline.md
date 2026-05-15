# Browser Pipeline

Use `prepareImageInBrowserPipeline()` when byte-budget preparation should prefer a worker and fall back to the main thread only when the worker path is unavailable.

```ts
import {
  detectBrowserImagePipelineSupport,
  prepareImageInBrowserPipeline
} from 'image-drop-input/headless';

const support = await detectBrowserImagePipelineSupport();

const prepared = await prepareImageInBrowserPipeline({
  file,
  policy: {
    outputMaxBytes: 500_000,
    outputType: 'image/webp',
    maxWidth: 1600,
    maxHeight: 1600,
    maxProcessingMs: 2_000
  }
});

prepared.mode;        // worker or main-thread
prepared.result.file; // prepared Blob
prepared.support;     // detected browser capabilities
support.nativeEncode['image/webp'];
```

The returned `result` is the same prepared image shape as `prepareImageToBudget()`. Keep `outputMaxBytes` validation on the component or app boundary before upload.

## Worker and Fallback

`preferredMode: 'auto'` is the default. In that mode:

- module worker support is detected first
- worker preparation is attempted where supported
- setup failures fall back to `prepareImageToBudget()` on the main thread
- budget, decode, encode, and cancellation errors do not silently retry in another mode

Use `preferredMode: 'worker'` when a product must fail rather than process on the main thread. Use `preferredMode: 'main-thread'` for controlled debugging or environments that disallow workers.

If a strict CSP blocks Blob worker probing, pass an app-owned `workerUrl`. The pipeline will try that explicit module worker URL before falling back in `auto` mode.

## Cancellation

Pass an `AbortSignal` to cancel the active job. Worker cancellation terminates the worker, so no prepared result is emitted after abort.

```ts
const controller = new AbortController();

const job = prepareImageInBrowserPipeline(
  { file, policy },
  { signal: controller.signal }
);

controller.abort();
await job; // rejects with ImagePipelineError code "cancelled"
```

`timeoutMs` can be passed as an option, or `maxProcessingMs` can be placed on the policy. Timeouts reject with `ImagePipelineError` code `timeout`.

## Local Draft Refs

The worker protocol accepts either a structured-cloned `File` / `Blob` or a `LocalImageDraftFileRef`. File refs are worker-only because the main-thread fallback cannot resolve a ref without the app-owned draft store instance.

For OPFS refs, the worker reads through `navigator.storage.getDirectory()`. For IndexedDB refs saved or read by `createLocalImageDraftStore()`, the ref carries the draft-store database name so namespaces and draft IDs may contain `:` safely. Pass `storage.databaseName` only when using an app-owned key shape.

## Format Stance

PNG, JPEG, and WebP are the supported byte-budget output types today. AVIF is detected in `support.nativeEncode['image/avif']`, but the package does not ship a Wasm AVIF codec pack. Treat AVIF as opt-in app work until a codec pack is explicitly configured and benchmarked.

The server remains the authority for auth, policy, upload targets, and persisted product state. Browser processing is a preparation step, not a security boundary.
