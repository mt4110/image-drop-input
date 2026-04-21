# image-drop-input

[English README](./README.md) · [Demo](https://mt4110.github.io/image-drop-input/) · [Issues](https://github.com/mt4110/image-drop-input/issues)

upload 前に起きる面倒なことを引き受ける、軽量な React 画像 input です。

drop / browse / paste / preview / validate / compress / upload を、UI framework や cloud SDK に縛られずに組み込めます。

## なぜ

多くの upload component は「file を受け取る」ところで止まります。

実際の product form では、それだけでは足りません。

- 選択直後にローカル preview を出したい
- 大きすぎる画像、小さすぎる画像、形式違いを弾きたい
- upload 前に圧縮や WebP 変換をしたい
- 一時 preview と保存済み URL を分けたい
- S3 / R2 / GCS / Azure Blob / 独自 API につなぎたい
- client bundle に cloud SDK を入れたくない
- accessibility と差し替えやすさを保ちたい

`image-drop-input` は、単なる uploader ではなく pre-upload image flow のための input です。

名前には `drop` が入っていますが、価値は drag and drop だけではありません。upload 前に画像を安全に整えるための component です。

## インストール

```bash
npm install image-drop-input react
```

default CSS を一度 import してください。

```tsx
import 'image-drop-input/style.css';
```

## 最短導入

`upload` を省略すると、local-preview-only の画像 input として使えます。

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
| WebP conversion | Yes |
| Presigned PUT upload | Yes |
| Multipart POST upload | Yes |
| Raw PUT upload | Yes |
| Headless hook | Yes |
| Runtime dependencies | React peer dependency only |

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

upload が失敗した場合、component は最後に commit 済みの値へ戻り、Retry では同じ prepared file を再送します。

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
        mimeType: context.mimeType,
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

validation は transform の前後で走ります。

## よく使う props

| Prop | Purpose |
| --- | --- |
| `value` | 現在の画像 value |
| `onChange` | 次の画像 value を受け取る |
| `upload` | optional upload adapter |
| `transform` | optional pre-upload transform |
| `accept` | 受け付ける MIME type / extension |
| `maxBytes` | 最大 file size |
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
| `onError` / `onProgress` | error / progress callback |

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

## When not to use this

次が必要なら別 tool の方が向いています。

- generic multi-file uploader
- resumable / chunked upload
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

今後の方針は [ROADMAP.md](./ROADMAP.md) に分けています。README は「今使える価値」に寄せています。
