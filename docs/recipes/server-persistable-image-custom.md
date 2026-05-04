# Server persistable image schema without dependencies

Use this recipe when your server does not use Zod, Valibot, or another schema library. It follows the same submit-boundary safety rule as `toPersistableImageValue()`: reject browser-only state and temporary `src` schemes while allowing durable `src` or `key` references. The MIME and integer checks are app-side policy examples.

Client sanitization is UX. Server validation is authority.

## Validator

```ts
type ServerPersistableImageValue = {
  src?: string;
  key?: string;
  fileName?: string;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  size?: number;
  width?: number;
  height?: number;
};

const allowedMimeTypes = new Set<NonNullable<ServerPersistableImageValue['mimeType']>>([
  'image/jpeg',
  'image/png',
  'image/webp'
]);
const temporarySrcSchemes = new Set(['blob', 'filesystem', 'data']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readUriScheme(value: string): string | undefined {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(value.trim());

  return match?.[1]?.toLowerCase();
}

function readOptionalNonEmptyString(
  value: unknown,
  field: string
): string | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string.`);
  }

  return value;
}

function readOptionalNonNegativeInteger(
  value: unknown,
  field: string
): number | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }

  return value;
}

function readOptionalPositiveInteger(
  value: unknown,
  field: string
): number | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }

  return value;
}

function isAllowedMimeType(
  value: string
): value is NonNullable<ServerPersistableImageValue['mimeType']> {
  return allowedMimeTypes.has(value as NonNullable<ServerPersistableImageValue['mimeType']>);
}

function readOptionalMimeType(value: unknown): ServerPersistableImageValue['mimeType'] {
  if (typeof value === 'undefined') {
    return undefined;
  }

  const mimeType = readOptionalNonEmptyString(value, 'mimeType');

  if (typeof mimeType === 'undefined' || !isAllowedMimeType(mimeType)) {
    throw new Error('mimeType is not allowed for this image field.');
  }

  return mimeType;
}

export function parsePersistableImageValue(
  value: unknown
): ServerPersistableImageValue | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error('image must be an object or null.');
  }

  if ('previewSrc' in value) {
    throw new Error('previewSrc is browser-only state and cannot be persisted.');
  }

  const allowedKeys = new Set([
    'src',
    'key',
    'fileName',
    'mimeType',
    'size',
    'width',
    'height'
  ]);

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unexpected image field: ${key}.`);
    }
  }

  const src = readOptionalNonEmptyString(value.src, 'src');
  const key = readOptionalNonEmptyString(value.key, 'key');
  const fileName = readOptionalNonEmptyString(value.fileName, 'fileName');
  const mimeType = readOptionalMimeType(value.mimeType);
  const size = readOptionalNonNegativeInteger(value.size, 'size');
  const width = readOptionalPositiveInteger(value.width, 'width');
  const height = readOptionalPositiveInteger(value.height, 'height');

  if (!src && !key) {
    throw new Error('image must include src or key.');
  }

  if (src) {
    const scheme = readUriScheme(src);

    if (scheme && temporarySrcSchemes.has(scheme)) {
      throw new Error('Temporary image URLs are not persistable.');
    }
  }

  return {
    ...(src ? { src } : {}),
    ...(key ? { key } : {}),
    ...(fileName ? { fileName } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(typeof size === 'number' ? { size } : {}),
    ...(typeof width === 'number' ? { width } : {}),
    ...(typeof height === 'number' ? { height } : {})
  };
}
```

`src` may be an absolute CDN URL or a durable app-relative path such as `/images/avatar.webp`. The validator checks the URI scheme directly so it can reject temporary browser values without requiring `new URL(src)` to parse successfully.

## Server policy checks

Shape validation is only the first layer. Add product-specific checks after parsing:

- require `key` for private buckets
- verify the key belongs to the authenticated tenant and product purpose
- verify a submitted draft still exists and has not expired
- reject MIME types or dimensions outside the product policy
- load the existing product row before deciding previous-image cleanup

Never trust `previousKey` from the browser as authority. Treat it as a hint at most.

Do not log signed upload URLs, draft tokens, raw storage headers, local `blob:` URLs, file contents, EXIF metadata, or full object keys that contain tenant or user identifiers.
