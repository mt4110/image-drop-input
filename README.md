# image-drop-input

[English README](./README_en.md)

軽量・高速・依存少なめの **React 向け画像アップロード入力コンポーネント** です。

ドラッグ & ドロップ、クリック選択、クリップボード貼り付け、ローカルプレビュー、プレビューダイアログ、画像圧縮、
そして **Presigned URL / 独自 API** を使ったアップロードを、重い UI 依存や cloud SDK なしで扱えます。

default skin はできるだけ静かに、そして dark mode / high contrast / reduced transparency / compact width でも
面の役割が崩れにくいように設計しています。

## 特徴

- React の peer dependency 以外に runtime dependency を持たない
- 単一画像アップロードに必要な UX をひと通り持つ
- `src` と `previewSrc` を分けて、保存対象と一時プレビューを混線させない
- upload adapter を URL 文字列から推測せず、明示的な API で差し替えられる
- root export は UI 寄り、低レベル API は `/headless` に分離
- Vite / Rsbuild の両方で consumption を検証済み

## インストール

```bash
npm install image-drop-input react
```

```tsx
import 'image-drop-input/style.css';
```

> `react-dom` は多くの React Web アプリですでに入っています。まだ導入していない環境では、必要に応じて一緒に追加してください。

## 最短導入

`upload` を渡さなければ、ローカル preview 専用の入力として使えます。

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
      aspectRatio={1}
      dropzoneStyle={{ minBlockSize: '20rem' }}
    />
  );
}
```

`onChange` では次のような value が返ります。

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

## value の意味

- `src`: 永続化済み、または共有可能な画像参照
- `previewSrc`: 一時プレビュー用のローカル object URL

この区別はかなり大事です。

- upload が `src` を返したときは `src` が表示に使われます
- upload が `key` だけを返したときは、`blob:` URL は `previewSrc` に残ります
- upload 失敗時は draft preview を破棄して、最後に commit 済みの value に戻ります

見た目だけ先に進んで、保存対象と UI がズレる事故を避けるためです。

## よく使う props

| prop | 役割 |
| --- | --- |
| `accept` | 受け付ける MIME。既定値は `image/*` |
| `maxBytes` | 最大ファイルサイズ |
| `minWidth` / `minHeight` | 最小画像寸法 |
| `maxWidth` / `maxHeight` | 最大画像寸法 |
| `maxPixels` | 最大ピクセル数 |
| `aspectRatio` | dropzone のアスペクト比 |
| `disabled` | 入力全体を無効化 |
| `removable` | 削除操作の有効化。既定値は `true` |
| `previewable` | preview dialog の有効化 |
| `onError` | validation / upload error の受け取り |
| `onProgress` | upload progress の受け取り |

`previewable` を推奨しつつ、既存互換のために `zoomable` も残しています。
ただし現在の機能は preview dialog であり、wheel / pinch / pan を含む本格的な zoom UI ではありません。

## アップロードをつなぐ

### 1. Presigned PUT

S3 / R2 / GCS / Azure のような構成では、`/headless` の uploader factory を使うのが素直です。

```tsx
import { useState } from 'react';
import {
  ImageDropInput,
  type ImageUploadValue
} from 'image-drop-input';
import {
  createPresignedPutUploader
} from 'image-drop-input/headless';
import 'image-drop-input/style.css';

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
      throw new Error('Failed to get upload target.');
    }

    return response.json();
  }
});

export function AvatarUploader() {
  const [value, setValue] = useState<ImageUploadValue | null>(null);

  return <ImageDropInput value={value} onChange={setValue} upload={upload} />;
}
```

`getTarget()` は次を返す想定です。

```ts
type PresignedPutTarget = {
  uploadUrl: string;
  headers?: Record<string, string>;
  publicUrl?: string;
  objectKey?: string;
};
```

package 側は **「与えられた URL とヘッダーで PUT する」** だけに徹します。
provider 判定や public URL の推測はしません。

### 2. Multipart POST

アプリケーションサーバーへ `multipart/form-data` で送る場合です。

```ts
import { createMultipartUploader } from 'image-drop-input/headless';

const upload = createMultipartUploader({
  endpoint: '/api/upload',
  fieldName: 'file'
});
```

既定では `src` / `publicUrl` / `url`、`key` / `objectKey` をゆるく拾います。
レスポンス形状が違う場合は `mapResponse` で変換できます。

### 3. Raw PUT

単純な PUT エンドポイントならこちらです。

```ts
import { createRawPutUploader } from 'image-drop-input/headless';

const upload = createRawPutUploader({
  endpoint: 'https://upload.example.com/files/avatar.jpg',
  publicUrl: 'https://cdn.example.com/avatar.jpg',
  objectKey: 'avatars/avatar.jpg'
});
```

## transform と圧縮

`transform` は `Blob | File | { file, fileName?, mimeType? }` を返せます。
圧縮や変換は `/headless` の `compressImage()` を使うと扱いやすいです。

```tsx
import { compressImage } from 'image-drop-input/headless';

<ImageDropInput
  transform={(file) =>
    compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.86
    })
  }
/>
```

ファイル名や MIME を明示したい場合はこう返せます。

```ts
transform={async (file) => ({
  file: await compressImage(file, { maxWidth: 1600 }),
  fileName: file.name.replace(/\.png$/i, '.webp'),
  mimeType: 'image/webp'
})}
```

validation は transform 前後の両方で走るので、変換後の寸法や MIME も検証されます。

## カスタマイズ

### `messages` と `classNames`

文言や aria-label は `messages`、各パーツの class hook は `classNames` で差し替えられます。

```tsx
<ImageDropInput
  messages={{
    placeholderTitle: 'プロフィール画像を選択',
    placeholderDescription: 'ドラッグ、クリック、または貼り付け',
    statusUploading: (percent) => `アップロード中 ${percent}%`
  }}
  classNames={{
    root: 'profileImageInput',
    dropzone: 'profileImageInput__surface',
    actions: 'profileImageInput__actions',
    status: 'profileImageInput__status',
    dialog: 'profileImageInput__dialog'
  }}
/>
```

### 部分レンダリング差し替え

`renderPlaceholder` / `renderActions` / `renderFooter` を使うと、コンポーネントを fork せずに
必要な部分だけ差し替えられます。

```tsx
<ImageDropInput
  renderFooter={({ statusMessage, canRetryUpload, retryUpload }) => (
    <div className="profileImageInput__footer">
      <span>{statusMessage}</span>
      {canRetryUpload ? (
        <button type="button" onClick={retryUpload}>
          再試行
        </button>
      ) : null}
    </div>
  )}
/>
```

default の actions / footer wrapper は click と keydown の伝播を吸収するので、
custom button 側で毎回 `stopPropagation()` を書かなくても file dialog が暴発しにくくなっています。

## headless API

UI を全面的に組み直したい場合は、`image-drop-input/headless` の
`useImageDropInput()` を直接使えます。

```tsx
import { useImageDropInput } from 'image-drop-input/headless';

export function CustomImageField() {
  const imageInput = useImageDropInput({
    accept: 'image/*',
    maxBytes: 5 * 1024 * 1024
  });

  return (
    <>
      <input
        ref={imageInput.inputRef}
        type="file"
        accept={imageInput.accept}
        onChange={imageInput.handleInputChange}
        hidden
      />

      <div
        role="button"
        tabIndex={0}
        onClick={imageInput.openFileDialog}
        onKeyDown={imageInput.handleKeyDown}
        onDragOver={imageInput.handleDragOver}
        onDragLeave={imageInput.handleDragLeave}
        onDrop={imageInput.handleDrop}
        onPaste={imageInput.handlePaste}
      >
        {imageInput.displaySrc ? (
          <img src={imageInput.displaySrc} alt={imageInput.messages.selectedImageAlt} />
        ) : (
          <span>{imageInput.messages.placeholderTitle}</span>
        )}
      </div>

      <p>{imageInput.statusMessage}</p>
    </>
  );
}
```

## root export と `/headless`

root entry の `image-drop-input` は UI 寄りです。

```ts
import {
  ImageDropInput,
  type ImageDropInputProps,
  type ImageUploadValue,
  type UploadAdapter,
  type UploadContext,
  type UploadResult
} from 'image-drop-input';
```

低レベル API は `/headless` へ寄せています。

```ts
import {
  compressImage,
  createMultipartUploader,
  createPresignedPutUploader,
  createRawPutUploader,
  getImageMetadata,
  useImageDropInput,
  validateImage
} from 'image-drop-input/headless';
```

公開面を静かに保つために、この import 境界は意図的に分けています。

## アクセシビリティと挙動メモ

- empty state は `button` role を持ち、`Enter` / `Space` で file dialog を開けます
- filled state は `group` として扱い、誤ってクリックだけで picker を開かないようにしています
- `Delete` / `Backspace` で削除できます（`removable` が有効な場合）
- 画像の paste に対応しています
- preview dialog は `Escape` で閉じ、開いている間は focus を中に留めます
- preview dialog は依存を増やさないため現状 portal ではなく inline 描画です
- 祖先に `transform` / `filter` などの stacking context がある場合は、より app root に近い位置へ置くか、headless API で独自 dialog に差し替えてください

## 開発

```bash
npm ci
npm test
npm run typecheck
npm run build:lib
npm run build:examples
npm run check:package
```

- example consumer は `examples/vite` と `examples/rsbuild` にあります
- `npm run clean:share` で `node_modules` と生成物を落とせます
- Node は `22.18+` か、それ以降のアクティブ LTS を推奨します

## publish 前メモ

- publish owner や GitHub repository を変える場合は、`package.json` の `name` / `homepage` / `bugs` / `repository` を一緒に更新してください
- `npm pack --dry-run` と `npm run check:package` を最後に通すと安全です

## ひとことで

**「全部入り uploader」を作るのではなく、単一画像に強い・速い・壊れにくい入力部品として磨く。**

この package は、そのためのかなり静かな土台です。
