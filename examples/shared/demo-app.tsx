import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ImageDropInput, type ImageUploadValue } from 'image-drop-input';
import {
  compressImage,
  createMultipartUploader,
  createPresignedPutUploader,
  createRawPutUploader,
  type UploadRequest,
  type UploadResponse
} from 'image-drop-input/headless';
import {
  AvatarRecipe,
  CompressionRecipe,
  HeadlessRecipe,
  HeadlessRecipeCard,
  LocalPreviewRecipe,
  MultipartRecipe,
  PresignedPutRecipe,
  RawPutRecipe,
  WebPRecipe,
  copy,
  type Locale,
  type LocalizedText
} from './recipes';
import 'image-drop-input/style.css';
import './demo.css';

type FlowMode = 'preview' | 'presigned' | 'multipart' | 'raw';
type SurfaceMode = 'avatar' | 'cover';

interface DemoAppProps {
  consumerName: string;
  consumerNote: LocalizedText;
  demoCommand: string;
  alternateDemoCommand: string;
  uploadKeyPrefix: string;
}

interface SurfaceOption {
  id: SurfaceMode;
  aspectRatio: '1/1' | '16/9';
  fileLabel: string;
  maxWidth: number;
  maxHeight: number;
  accent: string;
  dragLine: string;
  focusRing: string;
  title: LocalizedText;
  description: LocalizedText;
}

interface FlowOption {
  id: FlowMode;
  title: LocalizedText;
  description: LocalizedText;
}

interface UploadTrace {
  context: {
    fileName?: string;
    originalFileName?: string;
    mimeType?: string;
    size: number;
  };
  target: {
    uploadUrl: string;
    headers: Record<string, string>;
    publicUrl?: string;
    objectKey?: string;
  };
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    size?: number;
  } | null;
  response: {
    status: number;
    etag?: string;
    body?: unknown;
  } | null;
}

const SURFACES: SurfaceOption[] = [
  {
    id: 'cover',
    aspectRatio: '16/9',
    fileLabel: 'cover',
    maxWidth: 1600,
    maxHeight: 900,
    accent: '#d46a47',
    dragLine: 'rgba(212, 106, 71, 0.26)',
    focusRing: 'rgba(212, 106, 71, 0.14)',
    title: { en: 'Cover', jp: 'カバー' },
    description: {
      en: '16:9 for CMS covers, post headers, and editor surfaces.',
      jp: 'CMS カバー、記事ヘッダー、エディタ画面向けの 16:9。'
    }
  },
  {
    id: 'avatar',
    aspectRatio: '1/1',
    fileLabel: 'avatar',
    maxWidth: 1200,
    maxHeight: 1200,
    accent: '#15866a',
    dragLine: 'rgba(21, 134, 106, 0.26)',
    focusRing: 'rgba(21, 134, 106, 0.14)',
    title: { en: 'Avatar', jp: 'アバター' },
    description: {
      en: '1:1 for settings, profiles, teams, and workspace icons.',
      jp: '設定画面、プロフィール、チーム、ワークスペース icon 向けの 1:1。'
    }
  }
];

const FLOWS: FlowOption[] = [
  {
    id: 'preview',
    title: { en: 'Preview only', jp: 'Preview only' },
    description: {
      en: 'No uploader attached. Good for forms that save later.',
      jp: 'upload は付けず、後でまとめて保存するフォーム向け。'
    }
  },
  {
    id: 'presigned',
    title: { en: 'Presigned PUT', jp: 'Presigned PUT' },
    description: {
      en: 'Mocked signed URL flow for S3, R2, GCS, or Azure Blob.',
      jp: 'S3 / R2 / GCS / Azure Blob 向けの signed URL mock。'
    }
  },
  {
    id: 'multipart',
    title: { en: 'Multipart POST', jp: 'Multipart POST' },
    description: {
      en: 'Classic app-server upload through FormData.',
      jp: 'FormData で app server に渡す classic upload。'
    }
  },
  {
    id: 'raw',
    title: { en: 'Raw PUT', jp: 'Raw PUT' },
    description: {
      en: 'Direct PUT endpoint that returns an object key only.',
      jp: 'object key だけを返す direct PUT endpoint。'
    }
  }
];

const TEXT = {
  title: {
    en: 'Everything before upload, in one image field.',
    jp: 'upload 前のすべてを、1 つの画像 field に。'
  },
  body: {
    en: 'Drop, browse, or paste one image. This demo shows preview, validation, WebP transform, upload adapters, and commit state through the same exported surface npm users consume.',
    jp: '画像を 1 枚 drop / browse / paste。preview、validation、WebP 変換、upload adapter、commit state まで、npm user と同じ export surface で確認できます。'
  },
  publishedSurface: { en: 'Published entrypoints', jp: '公開エントリポイント' },
  singleImageFirst: { en: 'Single-image first', jp: 'single-image first' },
  language: { en: 'Language', jp: '表示言語' },
  liveDemo: { en: 'Live demo', jp: 'ライブ demo' },
  stageTitle: {
    en: 'The drop surface stays calm. The wiring stays explicit.',
    jp: 'drop surface は静かに、つなぎ込みは明示的に。'
  },
  stageBody: {
    en: 'Use the same component for local preview or for a publish-ready path. `previewSrc` remains local, while `src` appears only after the uploader resolves.',
    jp: '同じ component を local preview にも publish-ready な流れにも使えます。`previewSrc` はローカルのまま保ち、`src` は uploader が返したあとにだけ現れます。'
  },
  useCase: { en: 'Use case', jp: '用途' },
  flow: { en: 'Flow', jp: 'フロー' },
  aspectRatio: { en: 'Aspect ratio', jp: 'アスペクト比' },
  transform: { en: 'Transform', jp: '変換' },
  upload: { en: 'Upload', jp: 'Upload' },
  transformValue: { en: 'compressImage() -> webp', jp: 'compressImage() -> webp' },
  uploadOff: { en: 'off', jp: 'なし' },
  failNext: { en: 'Fail next upload', jp: '次の upload を失敗させる' },
  failNextArmed: { en: 'Next upload will fail', jp: '次の upload は失敗します' },
  failHint: {
    en: 'Use this to verify the default error surface and retry action.',
    jp: 'default error surface と retry action の確認に使えます。'
  },
  canvasHint: {
    en: 'Paste works too. The preview dialog stays available, and the emitted value is visible on the right.',
    jp: 'paste にも対応しています。preview dialog もそのまま使えて、右側で返り値を追えます。'
  },
  sourceTitle: { en: 'Published surface', jp: '公開面の見え方' },
  sourceBody: {
    en: 'This consumer imports the package the same way downstream apps will. No direct source imports are used here.',
    jp: 'この consumer は downstream app と同じ import で package を読んでいます。source 直参照は使っていません。'
  },
  valueTitle: { en: 'Emitted value', jp: '返り値' },
  valueBody: {
    en: '`previewSrc` is local only. `src` appears only after the upload adapter returns.',
    jp: '`previewSrc` はローカル専用です。`src` は upload adapter が返したあとにだけ入ります。'
  },
  uploadTitle: { en: 'Upload trace', jp: 'Upload trace' },
  uploadBody: {
    en: 'In preview-only mode there is no request. In upload modes, the mock keeps each adapter contract visible without leaving the browser.',
    jp: 'preview-only ではリクエストは出ません。upload mode では、各 adapter contract をブラウザ内で見える形にしています。'
  },
  uploadIdle: {
    en: 'Drop one image to inspect the upload context, signed target, and response stub.',
    jp: '画像を 1 枚入れると、upload context と signed target、response stub を確認できます。'
  },
  previewIdle: {
    en: 'Preview-only mode keeps `src` empty and never creates a network request.',
    jp: 'preview-only では `src` は空のままで、ネットワークリクエストは発生しません。'
  },
  failedUpload: {
    en: 'Demo upload failed. Retry uploads the same prepared file again.',
    jp: 'demo upload に失敗しました。Retry は同じ prepared file を再送します。'
  },
  proofEyebrow: { en: 'What this demo proves', jp: 'この demo で確認できること' },
  proofTitle: { en: 'Adoption checks without reading the source.', jp: 'source を読まずに採用判断する。' },
  proofBody: {
    en: 'The important product contracts are visible: preview is temporary, transform happens before upload, adapters are explicit, and failures can be retried.',
    jp: '重要な product contract を見える化しています。preview は一時的、transform は upload 前、adapter は明示的、失敗時は retry 可能です。'
  },
  recipesEyebrow: { en: 'Examples', jp: 'Examples' },
  recipesTitle: { en: 'Small recipes for the common paths.', jp: 'よくある導線を小さく確認する。' },
  recipesBody: {
    en: 'These snippets use only the published API: local preview, WebP transform, signed upload, multipart upload, raw PUT, and headless UI.',
    jp: 'local preview、WebP transform、signed upload、multipart upload、raw PUT、headless UI を、公開 API だけで確認できます。'
  },
  shipTitle: { en: 'Demo to publish', jp: 'demo から publish まで' },
  shipBody: {
    en: 'The demo command, the package check, and the publish command now line up in one short path.',
    jp: 'demo 起動、package check、publish の順が、そのまま短い一本道になるようにそろえました。'
  },
  installStep: { en: 'Install', jp: 'Install' },
  demoStep: { en: 'Run current demo', jp: '現在の demo を起動' },
  parityStep: { en: 'Bundler parity', jp: '別 bundler でも確認' },
  dryRunStep: { en: 'Dry-run publish', jp: 'publish dry-run' },
  publishStep: { en: 'Publish', jp: 'Publish' },
  demoStepCopy: {
    en: 'Builds the library output first, then opens the consumer demo.',
    jp: '先にライブラリ出力を組み立ててから、consumer demo を起動します。'
  },
  parityStepCopy: {
    en: 'Use the second consumer when you want another bundler to read the same published surface.',
    jp: '同じ公開面を別 bundler でも読ませたいときはこちらです。'
  },
  dryRunStepCopy: {
    en: 'Runs the package checks and a dry pack so the tarball shape is visible before the real publish.',
    jp: '実 publish の前に、package check と dry pack で tarball の形まで確認します。'
  },
  publishStepCopy: {
    en: 'When you are happy with the package, this is the final command from the repo root.',
    jp: 'package の状態に納得できたら、repo root から最後に打つコマンドです。'
  },
  browseLabel: { en: 'Choose image file', jp: '画像を選択' },
  placeholderPreviewTitle: { en: 'Drop one image', jp: '画像を 1 枚ドロップ' },
  placeholderPublishTitle: { en: 'Drop one image for upload', jp: 'upload 用の画像を 1 枚ドロップ' },
  placeholderPreviewBody: {
    en: 'Click or paste. The transformed image stays local.',
    jp: 'クリックまたは paste。変換後の画像はローカルにとどまります。'
  },
  placeholderPublishBody: {
    en: 'Click or paste. The transformed image is handed to the uploader mock.',
    jp: 'クリックまたは paste。変換後の画像を uploader モックに渡します。'
  },
  idleStatusPreview: {
    en: 'Drop, browse, or paste. No upload is attached.',
    jp: 'drop / browse / paste。upload はまだ付いていません。'
  },
  idleStatusPublish: {
    en: 'Drop, browse, or paste. The upload contract stays visible.',
    jp: 'drop / browse / paste。upload の契約面が見える状態です。'
  },
  uploading: {
    en: 'Uploading prepared image',
    jp: '変換済み画像をアップロード中'
  }
} as const;

const PROOF_ITEMS = [
  {
    title: { en: 'Preview is not persistence', jp: 'preview は保存ではない' },
    body: {
      en: '`previewSrc` stays local. `src` appears only when an adapter returns a persisted URL.',
      jp: '`previewSrc` は local のままです。`src` は adapter が保存済み URL を返したときだけ入ります。'
    }
  },
  {
    title: { en: 'Transform runs first', jp: 'transform が先に走る' },
    body: {
      en: 'The selected image is compressed and converted to WebP before upload receives it.',
      jp: '選択画像は upload に渡る前に圧縮され、WebP に変換されます。'
    }
  },
  {
    title: { en: 'Adapters stay explicit', jp: 'adapter は明示的' },
    body: {
      en: 'Presigned PUT, multipart POST, and raw PUT are wired without cloud SDKs or URL guessing.',
      jp: 'Presigned PUT / multipart POST / raw PUT を、cloud SDK や URL 推測なしでつなぎます。'
    }
  },
  {
    title: { en: 'Errors are recoverable', jp: '失敗から戻れる' },
    body: {
      en: 'The failure toggle shows the default error surface and retry path.',
      jp: '失敗 toggle で default error surface と retry path を確認できます。'
    }
  }
] satisfies Array<{
  title: LocalizedText;
  body: LocalizedText;
}>;

const INPUT_CLASS_NAMES = {
  dropzone: 'demo-idiDropzone',
  preview: 'demo-idiPreview',
  image: 'demo-idiImage',
  overlay: 'demo-idiOverlay',
  actions: 'demo-idiActions',
  iconButton: 'demo-idiIconButton',
  footer: 'demo-idiFooter',
  status: 'demo-idiStatus',
  errorSurface: 'demo-idiError',
  footerButton: 'demo-idiFooterButton',
  dialog: 'demo-idiDialog',
  dialogImage: 'demo-idiDialogImage'
} as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createPreparedFileName(fileName: string, surface: SurfaceOption): string {
  const base = slugify(stripExtension(fileName)) || 'image';
  return `${base}-${surface.fileLabel}.webp`;
}

function getFlowOption(flowMode: FlowMode): FlowOption {
  return FLOWS.find((option) => option.id === flowMode) ?? FLOWS[0];
}

function getBlobFileName(file: Blob, fallback: string): string {
  return 'name' in file && typeof file.name === 'string' && file.name.length > 0
    ? file.name
    : fallback;
}

function extractUploadBlob(body: UploadRequest['body']): Blob | null {
  if (body instanceof Blob) {
    return body;
  }

  for (const value of body.values()) {
    if (value instanceof Blob) {
      return value;
    }
  }

  return null;
}

function summarizeUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  return url.startsWith('blob:') ? 'blob:<local-object-url>' : url;
}

function summarizeValue(value: ImageUploadValue | null, locale: Locale): Record<string, unknown> {
  if (!value) {
    return {
      status: locale === 'en' ? 'idle' : '待機中'
    };
  }

  return {
    src: summarizeUrl(value.src),
    previewSrc: summarizeUrl(value.previewSrc),
    fileName: value.fileName,
    mimeType: value.mimeType,
    size: value.size,
    width: value.width,
    height: value.height,
    key: value.key
  };
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The upload was aborted.', 'AbortError');
  }

  const error = new Error('The upload was aborted.');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function buildSnippet(flow: FlowMode, surface: SurfaceOption): string {
  const uploadFactory =
    flow === 'presigned'
      ? ', createPresignedPutUploader'
      : flow === 'multipart'
        ? ', createMultipartUploader'
        : flow === 'raw'
          ? ', createRawPutUploader'
          : '';
  const uploadLine =
    flow === 'presigned'
      ? '  upload={createPresignedPutUploader({ getTarget, request })}'
      : flow === 'multipart'
        ? '  upload={createMultipartUploader({ endpoint, fieldName, request, mapResponse })}'
        : flow === 'raw'
          ? '  upload={createRawPutUploader({ endpoint, objectKey, request })}'
          : null;
  const lines = [
    "import { ImageDropInput } from 'image-drop-input';",
    `import { compressImage${uploadFactory} } from 'image-drop-input/headless';`,
    "import 'image-drop-input/style.css';",
    '',
    '<ImageDropInput',
    `  aspectRatio="${surface.aspectRatio}"`,
    '  previewable',
    '  transform={async (file) => {',
    '    const prepared = await compressImage(file, {',
    `      maxWidth: ${surface.maxWidth},`,
    `      maxHeight: ${surface.maxHeight},`,
    "      outputType: 'image/webp',",
    `      quality: ${flow === 'preview' ? '0.88' : '0.84'}`,
    '    });',
    '',
    "    return { file: prepared, fileName: 'prepared-image.webp', mimeType: 'image/webp' };",
    '  }}',
    uploadLine,
    '/>'
  ];

  return lines.filter((line): line is string => line != null).join('\n');
}

function buildUploadPanel(
  locale: Locale,
  flow: FlowMode,
  value: ImageUploadValue | null,
  uploadTrace: UploadTrace | null
): Record<string, unknown> {
  if (flow === 'preview') {
    return {
      upload: false,
      note: copy(locale, TEXT.previewIdle),
      result: {
        src: summarizeUrl(value?.src),
        previewSrc: summarizeUrl(value?.previewSrc)
      }
    };
  }

  if (!uploadTrace) {
    return {
      upload: true,
      adapter: copy(locale, getFlowOption(flow).title),
      note: copy(locale, TEXT.uploadIdle)
    };
  }

  return {
    adapter: copy(locale, getFlowOption(flow).title),
    context: uploadTrace.context,
    target: {
      ...uploadTrace.target,
      publicUrl: summarizeUrl(uploadTrace.target.publicUrl)
    },
    request: uploadTrace.request,
    response: uploadTrace.response,
    result: {
      src: summarizeUrl(value?.src),
      key: value?.key
    }
  };
}

function createThemeStyle(surface: SurfaceOption): CSSProperties {
  return {
    '--idi-accent': surface.accent,
    '--idi-drag-line': surface.dragLine,
    '--idi-focus-ring': surface.focusRing,
    '--idi-toolbar': 'rgba(249, 250, 251, 0.96)',
    '--idi-line': 'rgba(22, 32, 51, 0.08)',
    '--idi-line-strong': 'rgba(22, 32, 51, 0.14)',
    '--idi-dropzone-background':
      'linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(244, 246, 248, 0.98))',
    '--idi-placeholder-surface':
      'linear-gradient(180deg, rgba(249, 250, 251, 0.98), rgba(241, 244, 246, 0.96))',
    '--idi-shadow': '0 10px 24px rgba(15, 23, 42, 0.05)',
    '--idi-shadow-hover': '0 16px 30px rgba(15, 23, 42, 0.06)',
    '--idi-shadow-float': '0 8px 16px rgba(15, 23, 42, 0.06)',
    '--idi-dialog-shadow': '0 24px 48px rgba(15, 23, 42, 0.16)'
  } as CSSProperties;
}

export function DemoApp({
  consumerName,
  consumerNote,
  demoCommand,
  alternateDemoCommand,
  uploadKeyPrefix
}: DemoAppProps) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === 'undefined') {
      return 'en';
    }

    return window.localStorage.getItem('image-drop-input-demo-locale') === 'jp' ? 'jp' : 'en';
  });
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>('cover');
  const [flowMode, setFlowMode] = useState<FlowMode>('presigned');
  const [value, setValue] = useState<ImageUploadValue | null>(null);
  const [uploadTrace, setUploadTrace] = useState<UploadTrace | null>(null);
  const [failNextUpload, setFailNextUpload] = useState(false);
  const uploadPreviewUrlRef = useRef<string | null>(null);

  const surface = SURFACES.find((option) => option.id === surfaceMode) ?? SURFACES[0];
  const flow = getFlowOption(flowMode);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('image-drop-input-demo-locale', locale);
    }
  }, [locale]);

  useEffect(() => {
    setValue(null);
    setUploadTrace(null);
    setFailNextUpload(false);

    if (uploadPreviewUrlRef.current) {
      URL.revokeObjectURL(uploadPreviewUrlRef.current);
      uploadPreviewUrlRef.current = null;
    }
  }, [flowMode, surfaceMode]);

  useEffect(() => {
    return () => {
      if (uploadPreviewUrlRef.current) {
        URL.revokeObjectURL(uploadPreviewUrlRef.current);
      }
    };
  }, []);

  const upload = useMemo(() => {
    if (flowMode === 'preview') {
      return undefined;
    }

    const replacePreviewUrl = (file: Blob, fileName: string, mimeType: string): string => {
      if (uploadPreviewUrlRef.current) {
        URL.revokeObjectURL(uploadPreviewUrlRef.current);
        uploadPreviewUrlRef.current = null;
      }

      const publicFile = new File([file], fileName, { type: mimeType });
      const publicUrl = URL.createObjectURL(publicFile);

      uploadPreviewUrlRef.current = publicUrl;
      return publicUrl;
    };

    const recordRequest = (request: UploadRequest) => {
      setUploadTrace((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          request: {
            method: request.method,
            url: request.url,
            headers: request.headers ?? {},
            size: extractUploadBlob(request.body)?.size
          }
        };
      });
    };

    const runMockRequest = async (
      request: UploadRequest,
      body: unknown = {
        ok: true,
        consumer: consumerName
      }
    ): Promise<UploadResponse> => {
      recordRequest(request);

      for (const percent of [18, 42]) {
        throwIfAborted(request.signal);
        request.onProgress?.(percent);
        await delay(120);
      }

      if (failNextUpload) {
        setFailNextUpload(false);
        setUploadTrace((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            response: {
              status: 500,
              body: {
                ok: false,
                message: copy(locale, TEXT.failedUpload)
              }
            }
          };
        });
        throw new Error(copy(locale, TEXT.failedUpload));
      }

      for (const percent of [68, 100]) {
        throwIfAborted(request.signal);
        request.onProgress?.(percent);
        await delay(120);
      }

      const response = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'application/json',
          etag: '"demo-etag"'
        }),
        body
      } satisfies UploadResponse;

      setUploadTrace((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          response: {
            status: response.status,
            etag: response.headers.get('etag') ?? undefined,
            body: response.body
          }
        };
      });

      return response;
    };

    if (flowMode === 'presigned') {
      return createPresignedPutUploader({
        async getTarget(file, context) {
          const fileName =
            context.fileName ??
            createPreparedFileName(context.originalFileName ?? 'image', surface);
          const mimeType = context.mimeType ?? file.type ?? 'image/webp';
          const publicUrl = replacePreviewUrl(file, fileName, mimeType);
          const target = {
            uploadUrl: `https://uploads.example.test/${uploadKeyPrefix}/${fileName}`,
            headers: {
              'content-type': mimeType,
              'x-demo-consumer': consumerName.toLowerCase()
            },
            publicUrl,
            objectKey: `${uploadKeyPrefix}/${fileName}`
          };

          setUploadTrace({
            context: {
              fileName: context.fileName,
              originalFileName: context.originalFileName,
              mimeType: context.mimeType,
              size: file.size
            },
            target,
            request: null,
            response: null
          });

          return target;
        },
        request: runMockRequest
      });
    }

    if (flowMode === 'multipart') {
      return createMultipartUploader({
        endpoint: '/api/demo/upload',
        fieldName: 'file',
        async request(request): Promise<UploadResponse> {
          const file = extractUploadBlob(request.body);
          const fileName = file ? getBlobFileName(file, `${surface.fileLabel}.webp`) : `${surface.fileLabel}.webp`;
          const mimeType = file?.type || request.headers?.['content-type'] || 'image/webp';
          const publicUrl = file ? replacePreviewUrl(file, fileName, mimeType) : undefined;
          const objectKey = `${uploadKeyPrefix}/multipart/${fileName}`;

          setUploadTrace({
            context: {
              fileName,
              originalFileName: fileName,
              mimeType,
              size: file?.size ?? 0
            },
            target: {
              uploadUrl: request.url,
              headers: request.headers ?? {},
              publicUrl,
              objectKey
            },
            request: null,
            response: null
          });

          return runMockRequest(request, {
            imageUrl: publicUrl,
            imageKey: objectKey
          });
        },
        mapResponse(body) {
          const result = body as { imageUrl?: string; imageKey?: string };

          return {
            src: result.imageUrl,
            key: result.imageKey,
            response: body
          };
        }
      });
    }

    return createRawPutUploader({
      endpoint: `/api/demo/raw/${surface.fileLabel}`,
      objectKey: `${uploadKeyPrefix}/raw/${surface.fileLabel}.webp`,
      async request(request): Promise<UploadResponse> {
        const file = extractUploadBlob(request.body);
        const fileName = file ? getBlobFileName(file, `${surface.fileLabel}.webp`) : `${surface.fileLabel}.webp`;
        const mimeType = file?.type || request.headers?.['content-type'] || 'image/webp';

        if (uploadPreviewUrlRef.current) {
          URL.revokeObjectURL(uploadPreviewUrlRef.current);
          uploadPreviewUrlRef.current = null;
        }

        setUploadTrace({
          context: {
            fileName,
            originalFileName: fileName,
            mimeType,
            size: file?.size ?? 0
          },
          target: {
            uploadUrl: request.url,
            headers: request.headers ?? {},
            objectKey: `${uploadKeyPrefix}/raw/${surface.fileLabel}.webp`
          },
          request: null,
          response: null
        });

        return runMockRequest(request);
      }
    });
  }, [consumerName, failNextUpload, flowMode, locale, surface, uploadKeyPrefix]);

  const messages = {
    chooseFile: copy(locale, TEXT.browseLabel),
    placeholderTitle:
      flowMode !== 'preview'
        ? copy(locale, TEXT.placeholderPublishTitle)
        : copy(locale, TEXT.placeholderPreviewTitle),
    placeholderDescription:
      flowMode !== 'preview'
        ? copy(locale, TEXT.placeholderPublishBody)
        : copy(locale, TEXT.placeholderPreviewBody),
    statusIdle:
      flowMode !== 'preview'
        ? copy(locale, TEXT.idleStatusPublish)
        : copy(locale, TEXT.idleStatusPreview),
    statusUploading: (percent: number) => {
      const lead = copy(locale, TEXT.uploading);
      return percent > 0 ? `${lead}... ${percent}%` : `${lead}...`;
    }
  };

  const stepRows = [
    {
      label: copy(locale, TEXT.installStep),
      command: 'npm install image-drop-input react react-dom',
      copy: null
    },
    {
      label: copy(locale, TEXT.demoStep),
      command: demoCommand,
      copy: copy(locale, TEXT.demoStepCopy)
    },
    {
      label: copy(locale, TEXT.parityStep),
      command: alternateDemoCommand,
      copy: copy(locale, TEXT.parityStepCopy)
    },
    {
      label: copy(locale, TEXT.dryRunStep),
      command: 'npm run publish:check',
      copy: copy(locale, TEXT.dryRunStepCopy)
    },
    {
      label: copy(locale, TEXT.publishStep),
      command: 'npm publish --access public',
      copy: copy(locale, TEXT.publishStepCopy)
    }
  ];

  return (
    <main className="demo-shell">
      <section className="demo-page">
        <header className="demo-header">
          <div className="demo-badges">
            <span className="demo-badge">{consumerName}</span>
            <span className="demo-badge demo-badgeStrong">{copy(locale, TEXT.publishedSurface)}</span>
            <span className="demo-badge demo-badgeWarm">{copy(locale, TEXT.singleImageFirst)}</span>
          </div>

          <div className="demo-headerTop">
            <div className="demo-headerCopy">
              <h1 className="demo-title">{copy(locale, TEXT.title)}</h1>
              <p className="demo-body">
                {copy(locale, TEXT.body)} {copy(locale, consumerNote)}
              </p>
            </div>

            <div className="demo-locale" aria-label={copy(locale, TEXT.language)}>
              <span className="demo-localeLabel">{copy(locale, TEXT.language)}</span>
              {(['en', 'jp'] as const).map((option) => (
                <button
                  key={option}
                  className="demo-localeButton"
                  data-active={locale === option}
                  type="button"
                  onClick={() => {
                    setLocale(option);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </header>

        <section className="demo-workbench">
          <div className="demo-stage">
            <div className="demo-stageHeader">
              <div>
                <p className="demo-eyebrow">{copy(locale, TEXT.liveDemo)}</p>
                <h2 className="demo-stageTitle">{copy(locale, TEXT.stageTitle)}</h2>
                <p className="demo-stageDescription">{copy(locale, TEXT.stageBody)}</p>
              </div>

              <div className="demo-toolbar">
                <div className="demo-toggleGroup">
                  <span className="demo-toggleLabel">{copy(locale, TEXT.useCase)}</span>
                  <div className="demo-toggleRow">
                    {SURFACES.map((option) => (
                      <button
                        key={option.id}
                        className="demo-toggleButton"
                        data-active={surfaceMode === option.id}
                        type="button"
                        onClick={() => {
                          setSurfaceMode(option.id);
                        }}
                      >
                        <span className="demo-toggleTitle">{copy(locale, option.title)}</span>
                        <span className="demo-toggleCopy">{copy(locale, option.description)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="demo-toggleGroup">
                  <span className="demo-toggleLabel">{copy(locale, TEXT.flow)}</span>
                  <div className="demo-toggleRow">
                    {FLOWS.map((option) => (
                      <button
                        key={option.id}
                        className="demo-toggleButton"
                        data-active={flowMode === option.id}
                        type="button"
                        onClick={() => {
                          setFlowMode(option.id);
                        }}
                      >
                        <span className="demo-toggleTitle">{copy(locale, option.title)}</span>
                        <span className="demo-toggleCopy">{copy(locale, option.description)}</span>
                      </button>
                    ))}
                  </div>
                  {flowMode !== 'preview' ? (
                    <div className="demo-failureRow">
                      <button
                        className="demo-failureButton"
                        data-active={failNextUpload}
                        type="button"
                        onClick={() => {
                          setFailNextUpload((current) => !current);
                        }}
                      >
                        {failNextUpload
                          ? copy(locale, TEXT.failNextArmed)
                          : copy(locale, TEXT.failNext)}
                      </button>
                      <span className="demo-failureHint">{copy(locale, TEXT.failHint)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <dl className="demo-metrics">
                <div className="demo-metric">
                  <dt>{copy(locale, TEXT.aspectRatio)}</dt>
                  <dd>{surface.aspectRatio}</dd>
                </div>
                <div className="demo-metric">
                  <dt>{copy(locale, TEXT.transform)}</dt>
                  <dd>{copy(locale, TEXT.transformValue)}</dd>
                </div>
                <div className="demo-metric">
                  <dt>{copy(locale, TEXT.upload)}</dt>
                  <dd>{flowMode === 'preview' ? copy(locale, TEXT.uploadOff) : copy(locale, flow.title)}</dd>
                </div>
              </dl>
            </div>

            <div className="demo-canvas">
              <ImageDropInput
                accept="image/png,image/jpeg,image/webp,image/avif"
                aspectRatio={surface.aspectRatio}
                classNames={INPUT_CLASS_NAMES}
                dropzoneStyle={{ minBlockSize: surfaceMode === 'cover' ? '22rem' : '18rem' }}
                maxBytes={12 * 1024 * 1024}
                messages={messages}
                onChange={setValue}
                previewable
                rootStyle={createThemeStyle(surface)}
                transform={async (file) => {
                  const prepared = await compressImage(file, {
                    maxWidth: surface.maxWidth,
                    maxHeight: surface.maxHeight,
                    outputType: 'image/webp',
                    quality: flowMode === 'preview' ? 0.88 : 0.84
                  });

                  return {
                    file: prepared,
                    fileName: createPreparedFileName(file.name, surface),
                    mimeType: prepared.type || 'image/webp'
                  };
                }}
                upload={upload}
                value={value}
              />

              <p className="demo-canvasHint">{copy(locale, TEXT.canvasHint)}</p>
            </div>
          </div>

          <aside className="demo-inspector">
            <section className="demo-panel">
              <div>
                <h3 className="demo-panelTitle">{copy(locale, TEXT.sourceTitle)}</h3>
                <p className="demo-panelBody">{copy(locale, TEXT.sourceBody)}</p>
              </div>
              <pre className="demo-code">{buildSnippet(flowMode, surface)}</pre>
            </section>

            <section className="demo-panel">
              <div>
                <h3 className="demo-panelTitle">{copy(locale, TEXT.valueTitle)}</h3>
                <p className="demo-panelBody">{copy(locale, TEXT.valueBody)}</p>
              </div>
              <pre className="demo-json">{JSON.stringify(summarizeValue(value, locale), null, 2)}</pre>
            </section>

            <section className="demo-panel">
              <div>
                <h3 className="demo-panelTitle">{copy(locale, TEXT.uploadTitle)}</h3>
                <p className="demo-panelBody">{copy(locale, TEXT.uploadBody)}</p>
              </div>
              <pre className="demo-json">
                {JSON.stringify(buildUploadPanel(locale, flowMode, value, uploadTrace), null, 2)}
              </pre>
            </section>
          </aside>
        </section>

        <section className="demo-proof">
          <div className="demo-sectionHeader">
            <p className="demo-eyebrow">{copy(locale, TEXT.proofEyebrow)}</p>
            <h2 className="demo-sectionTitle">{copy(locale, TEXT.proofTitle)}</h2>
            <p className="demo-sectionBody">{copy(locale, TEXT.proofBody)}</p>
          </div>

          <div className="demo-proofGrid">
            {PROOF_ITEMS.map((item) => (
              <article key={copy('en', item.title)} className="demo-proofCard">
                <h3>{copy(locale, item.title)}</h3>
                <p>{copy(locale, item.body)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="demo-recipes">
          <div className="demo-sectionHeader">
            <p className="demo-eyebrow">{copy(locale, TEXT.recipesEyebrow)}</p>
            <h2 className="demo-sectionTitle">{copy(locale, TEXT.recipesTitle)}</h2>
            <p className="demo-sectionBody">{copy(locale, TEXT.recipesBody)}</p>
          </div>

          <div className="demo-recipeGrid">
            <LocalPreviewRecipe locale={locale} />
            <AvatarRecipe locale={locale} />
            <CompressionRecipe locale={locale} />
            <WebPRecipe locale={locale} />
            <PresignedPutRecipe locale={locale} />
            <MultipartRecipe locale={locale} />
            <RawPutRecipe locale={locale} />
            <HeadlessRecipeCard locale={locale} />
          </div>
        </section>

        <HeadlessRecipe locale={locale} />

        <section className="demo-ship">
          <div className="demo-shipHeader">
            <p className="demo-eyebrow">{copy(locale, TEXT.shipTitle)}</p>
            <h2 className="demo-shipTitle">{copy(locale, TEXT.shipTitle)}</h2>
            <p className="demo-shipBody">{copy(locale, TEXT.shipBody)}</p>
          </div>

          <ol className="demo-stepList">
            {stepRows.map((step) => (
              <li key={step.command} className="demo-step">
                <div>
                  <div className="demo-stepLabel">{step.label}</div>
                  {step.copy ? <div className="demo-stepCopy">{step.copy}</div> : null}
                </div>
                <code className="demo-command">{step.command}</code>
              </li>
            ))}
          </ol>
        </section>
      </section>
    </main>
  );
}
