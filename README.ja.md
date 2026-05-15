# image-drop-input

[English README](./README.md) · [Public docs](./docs/README.md) · [Demo](https://mt4110.github.io/image-drop-input/) · [Issues](https://github.com/mt4110/image-drop-input/issues)

プロダクト保存に耐える React 単一画像フィールド。

ローカルプレビュー、ポリシーに沿った画像準備、明示的なアップロード、
そして保存可能な画像状態だけの永続化を支援します。

avatar、workspace logo、CMS thumbnail、article cover、product image、admin form のための field です。generic file queue を目指していません。

- Persistable value guard: `toPersistableImageValue()` で submit 前に一時 `previewSrc` を落とす
- Byte-budget solver: `prepareImageToBudget()` で upload policy に収まる画像を準備する
- Draft lifecycle: `useImageDraftLifecycle()` で draft upload、commit、discard、previous cleanup を分ける
- Local draft recovery: `createLocalImageDraftStore()` と `useLocalImageDraftRecovery()` で、未保存の local draft に reload / tab crash 向けの bounded recovery を足す

**Upload success is not product save success.** upload の成功と product form の保存成功を分け、browser preview、prepared bytes、draft upload、committed image、保存 payload を混ぜないための package です。

詳細な公開 docs は現時点では English README と [docs](./docs/README.md) を canonical としています。この日本語 README は主要な導入と設計思想を押さえるための短い入口です。

## なぜ

通常の file input は `File` を返します。それは受け取り口としては十分ですが、product image state ではありません。

実際の product form では、それだけでは足りません。

- 選択直後にローカル preview を出したい
- 大きすぎる画像、小さすぎる画像、形式違いを弾きたい
- upload policy に収まるように画像を準備したい
- 一時 preview、draft object、保存済み URL を分けたい
- S3 / R2 / GCS / Azure Blob / 独自 API につなぎたい
- client bundle に cloud SDK を入れたくない
- form save が成功するまで画像を product state にしたくない
- accessibility と差し替えやすさを保ちたい

`image-drop-input` は、file intake だけではなく durable image-state boundary のための single image field です。

名前には `drop` が入っていますが、価値は drag and drop だけではありません。browser-only な状態を保存 payload に混ぜないための component と helper 群です。

## Native input との違い

| Need | Native `<input type="file">` | `image-drop-input` |
| --- | --- | --- |
| Local preview | object URL を自前管理 | built-in `previewSrc` pattern |
| transform 前後の validation | 自前実装 | built-in |
| `src` と `previewSrc` の分離 | convention 任せ | explicit value model |
| 保存 payload | 自前 sanitization | `toPersistableImageValue()` |
| byte budget に収める準備 | 自前調整 | `prepareImageToBudget()` |
| draft / commit lifecycle | 自前設計 | `useImageDraftLifecycle()` |
| signed upload wiring | 自前実装 | upload adapter contract |

## インストール

```bash
npm install image-drop-input react
```

default CSS を一度 import してください。

```tsx
import 'image-drop-input/style.css';
```

## Browser / client 境界

`ImageDropInput` は browser component です。Next.js App Router では `'use client'` を付けた Client Component から描画し、server 側には presign、auth、persistence、storage policy を置いてください。

組み込みの transform helper は browser の画像 decode と canvas encode に依存します。`transform` と `previewSrc` の扱いは browser 側に寄せ、保存するのは upload 後の `src` / `key` / metadata にしてください。`previewSrc` は DB や API payload に保存しません。

## 最短導入

`upload` を省略すると、local-preview-only の画像 field として使えます。

```tsx
import { useState } from 'react';
import {
  ImageDropInput,
  type ImageUploadValue
} from 'image-drop-input';
import 'image-drop-input/style.css';

export function AvatarField() {
  const [value, setValue] = useState<ImageUploadValue | null>(null);

  return (
    <ImageDropInput
      value={value}
      onChange={setValue}
      accept="image/png,image/jpeg,image/webp"
      maxBytes={5 * 1024 * 1024}
      aspectRatio={1}
    />
  );
}
```

## Pick your path

### 1. Local preview only

preview、paste、drag/drop、keyboard access、safe removal だけが必要なら `ImageDropInput` から始めてください。upload lifecycle は不要です。

### 2. Prepare and upload one image

転送前に upload policy へ収めたい場合は、`prepareImageToBudget()` と明示的な upload adapter を足してください。upload wiring は app 側で所有します。

### 3. Product-safe replacement flow

draft upload を product save まで persisted state にしたくない場合は、`toPersistableImageValue()` と `useImageDraftLifecycle()` を使ってください。

reload や tab crash 後にも未保存の local draft を復元候補として出したい場合は、`createLocalImageDraftStore()` と `useLocalImageDraftRecovery()` を足してください。これは crash-resilient local draft persistence であり、site data deletion や browser eviction まで保証するものではありません。

## 何が入っているか

| Feature | Included |
| --- | --- |
| Drag and drop | Yes |
| Click-to-select | Yes |
| Clipboard paste | Yes |
| Local preview | Yes |
| Preview dialog | Yes |
| Validation | MIME, size, dimensions, pixel budget |
| Transform hook | Yes |
| Compression helper | Yes |
| WebP conversion | Yes, browser の canvas encode support に依存 |
| Presigned PUT upload | Yes |
| Multipart POST upload | Yes |
| Raw PUT upload | Yes |
| Headless hook | Yes |
| Runtime dependencies | React peer dependency only |

## Durable image boundary

browser の画像入力には、`File`、`Blob`、object URL、upload progress、draft object のような一時値が混ざります。

DB や API payload に残したいのは、`src`、`key`、prepared metadata のような durable value です。

`image-drop-input` はこの境界を明示するために、submit payload を整える `toPersistableImageValue()`、byte budget に収める `prepareImageToBudget()`、upload success と form save success を分ける `useImageDraftLifecycle()` を提供します。

## Image lifecycle

```txt
pick / drop / paste
  -> validate
  -> transform
  -> validate again
  -> preview
  -> upload
  -> commit
```

user に見えている preview と、DB に保存してよい画像参照は同じではありません。

draft upload を form save 時に commit し、cancel 時に discard し、previous image を commit 後だけ cleanup したい場合は、server 側の契約を app で持ってください。詳しくは [Backend contracts](./docs/backend-contracts.md)、[Draft lifecycle](./docs/draft-lifecycle.md)、[Next.js draft lifecycle recipe](./docs/recipes/nextjs-draft-lifecycle.md) を参照してください。

## Validation と byte limit

validation は transform の前後で走ります。

`maxBytes` は互換性のための convenience limit です。source file と transformed file の両方に適用されます。

```txt
source file must be <= maxBytes
transformed file must be <= maxBytes
```

大きな camera image を受け取り、圧縮後の出力だけを 500,000 bytes 以下にしたい場合は、stage を分けて指定してください。

```tsx
import { ImageDropInput } from 'image-drop-input';
import { prepareImageToBudget } from 'image-drop-input/headless';

<ImageDropInput
  inputMaxBytes={20 * 1024 * 1024}
  outputMaxBytes={500_000}
  transform={async (file) => {
    const prepared = await prepareImageToBudget(file, {
      outputMaxBytes: 500_000,
      outputType: 'image/webp',
      maxWidth: 1600,
      maxHeight: 1600
    });

    return {
      file: prepared.file,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType
    };
  }}
/>
```

`inputMaxBytes` / `outputMaxBytes` を指定した stage では、その値が `maxBytes` より優先されます。詳細は [Validation](./docs/validation.md) と [Byte budget solver](./docs/byte-budget.md) を参照してください。

## Value model

```ts
type ImageUploadValue = {
  src?: string;
  previewSrc?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  key?: string;
};
```

- `src`: 保存済み、または共有可能な画像 URL
- `previewSrc`: 一時的な local preview URL。多くの場合 `blob:` URL

この 2 つを分けることで、「見た目は保存済みに見えるが実際は upload できていない」という事故を避けます。

`previewSrc` は一時的な UI state です。保存 payload からは外し、upload 後に得られた `src` / `key` / metadata を保存してください。

upload が失敗した場合、component は最後に commit 済みの値へ戻り、Retry では同じ prepared file を再送します。

## 保存してよい値だけにする

form submit の直前で `toPersistableImageValue()` を使うと、`previewSrc` を落とし、`blob:` などの一時 URL を保存 payload に混ぜる事故を防げます。

```tsx
import { toPersistableImageValue } from 'image-drop-input';

async function submitProfile() {
  const image = toPersistableImageValue(value);

  await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image })
  });
}
```

`src` または `key` のような永続参照だけを API / DB に渡してください。詳しくは [Persistable value guard](./docs/persistable-value.md) を参照してください。

## Recipes

- [Persistable value](./docs/persistable-value.md)
- [Byte-budget solver](./docs/byte-budget.md)
- [Backend contracts](./docs/backend-contracts.md)
- [Draft lifecycle](./docs/draft-lifecycle.md)
- [Next.js App Router](./docs/recipes/nextjs-app-router.md)
- [Next.js presign route](./docs/recipes/nextjs-presign-route.md)
- [Next.js draft lifecycle](./docs/recipes/nextjs-draft-lifecycle.md)
- [React Hook Form and Zod](./docs/recipes/react-hook-form-zod.md)

## Upload examples

### Local preview only

```tsx
<ImageDropInput
  value={value}
  onChange={setValue}
/>
```

### Presigned PUT

```tsx
import { createPresignedPutUploader } from 'image-drop-input/headless';

const upload = createPresignedPutUploader({
  async getTarget(file, context) {
    const response = await fetch('/api/uploads/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: context.fileName,
        originalFileName: context.originalFileName,
        mimeType: context.mimeType ?? file.type,
        size: file.size
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create upload URL.');
    }

    return response.json();
  }
});
```

presign endpoint は次の形を返してください。

```ts
type PresignedPutTarget = {
  uploadUrl: string;
  headers?: Record<string, string>;
  publicUrl?: string;
  objectKey?: string;
};
```

package は upload URL から public URL を推測しません。`publicUrl` または `objectKey` を明示してください。

`UploadResult` の `etag` / `response` は custom adapter の診断や内部処理には使えますが、`onChange` で返る UI value には含めません。`ImageUploadValue` は product state として必要な `src`, `previewSrc`, `key`, file metadata, dimensions に絞っています。

### Multipart POST

```ts
import { createMultipartUploader } from 'image-drop-input/headless';

const upload = createMultipartUploader({
  endpoint: '/api/upload',
  fieldName: 'file'
});
```

### Raw PUT

```ts
import { createRawPutUploader } from 'image-drop-input/headless';

const upload = createRawPutUploader({
  endpoint: '/api/avatar',
  publicUrl: '/avatars/current-user.jpg',
  objectKey: 'avatars/current-user.jpg'
});
```

## Transform と compression

```tsx
import { compressImage } from 'image-drop-input/headless';

<ImageDropInput
  value={value}
  onChange={setValue}
  transform={(file) =>
    compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.86
    })
  }
/>
```

WebP 変換もできます。

```tsx
<ImageDropInput
  value={value}
  onChange={setValue}
  accept="image/png,image/jpeg,image/webp"
  transform={async (file) => ({
    file: await compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      outputType: 'image/webp',
      quality: 0.86
    }),
    fileName: file.name.replace(/\.(png|jpe?g|webp)$/i, '.webp'),
    mimeType: 'image/webp'
  })}
/>
```

明示的に `outputType` を指定した場合、`compressImage()` は encode 後の blob type を確認します。browser が指定形式で encode できず別形式に fallback した場合は、bytes と MIME metadata がズレた blob を返さずに reject します。

## よく使う props

| Prop | Purpose |
| --- | --- |
| `value` | 現在の画像 value |
| `onChange` | 次の画像 value を受け取る |
| `upload` | optional upload adapter |
| `transform` | optional pre-upload transform |
| `accept` | 受け付ける MIME type / extension |
| `inputMaxBytes` | transform 前の source file size limit |
| `maxBytes` | 互換性用。transform 前後の両方にかかる size limit |
| `outputMaxBytes` | transform 後の file size limit |
| `minWidth` / `minHeight` | 最小画像寸法 |
| `maxWidth` / `maxHeight` | 最大画像寸法 |
| `maxPixels` | 最大 pixel 数 |
| `disabled` | input を無効化 |
| `removable` | remove action を有効化 |
| `previewable` | preview dialog を有効化 |
| `capture` | file input の camera capture hint |
| `aspectRatio` | dropzone の aspect ratio |
| `messages` | copy と aria label の上書き |
| `classNames` | part-level class names |
| `renderPlaceholder` / `renderActions` / `renderFooter` | 部分 render 差し替え |
| `onError` | validation / upload error callback |
| `onProgress` | upload progress callback。成功時は最後に `100` を通知 |

## Validation error

validation error は通常の `Error` として扱えますが、localize できるように stable な `code` と `details` を持ちます。

```ts
import { isImageValidationError } from 'image-drop-input';

function toMessage(error: Error) {
  if (isImageValidationError(error)) {
    if (error.code === 'file_too_large') {
      return `${error.details.maxBytes} bytes 以下の画像を選んでください。`;
    }
  }

  return error.message;
}
```

code は `invalid_type`, `file_too_large`, `image_too_small`, `image_too_large`, `too_many_pixels`, `decode_failed` です。英語 message を parse せずに翻訳できます。

## Upload error

組み込み upload helper の失敗は `ImageUploadError` として扱えます。`code` と `details` を見ることで、toast、retry copy、telemetry を `error.message` に依存せずに組めます。

```ts
import { isImageUploadError } from 'image-drop-input';

function toUploadMessage(error: Error) {
  if (!isImageUploadError(error)) {
    return '画像を準備できませんでした。';
  }

  if (error.code === 'http_error' && error.details.status === 413) {
    return 'アップロード先の上限を超えています。';
  }

  if (error.code === 'network_error') {
    return '通信が切れました。もう一度お試しください。';
  }

  return '画像をアップロードできませんでした。';
}
```

`details.stage`, `details.method`, `details.status` は telemetry に使えます。実際の再送は default UI の Retry、または headless の `canRetryUpload` / `retryUpload()` を使ってください。

## Headless usage

UI を自前で組みたい場合は `useImageDropInput()` を使います。

```tsx
import { useImageDropInput } from 'image-drop-input/headless';

const imageInput = useImageDropInput({
  accept: 'image/*',
  maxBytes: 5 * 1024 * 1024
});
```

headless API を wrapper 化する場合に使える `UseImageDropInputReturn` も export しています。

## Multiple images

この package は intentionally single-image first です。

複数画像は、app 側で array state を持ち、item ごとに `ImageDropInput` または `useImageDropInput()` を使ってください。並び替え、削除、保存状態、upload orchestration は product 層で持つ方が破綻しにくいです。

## 他の upload tool との使い分け

queue、remote source、resumable upload、image editor、storage-as-a-service が必要な場合は、Uppy、FilePond、Uploady、provider widget がよく合います。

`image-drop-input` が向いているのは、browser-only preview state、draft upload state、persisted product state を分けたい 1 枚画像の form field です。

## When not to use this

次が必要なら別 tool の方が向いています。

- generic multi-file queue
- resumable / chunked upload
- remote file source
- full crop / rotate / annotation editor
- provider-specific SDK wrapper
- Node-side image processing

## 開発

```bash
npm ci
npm run typecheck
npm test
npm run build:lib
npm run build:examples
npm run check:package
npm pack --dry-run
```

今後の方針は npm package の外に分けています。README は「今使える価値」に寄せています。
