# Repository plan

## Recommended repository name

`image-drop-input`

## Recommended title

`image-drop-input — Lightweight React image uploader with preview, preview dialog, compression, and pluggable uploads`

## Recommended structure

```txt
image-drop-input/
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     └─ release.yml
├─ examples/
│  ├─ vite/
│  └─ rsbuild/
├─ src/
│  ├─ core/
│  │  ├─ compress-image.ts
│  │  ├─ create-object-url.ts
│  │  ├─ get-image-metadata.ts
│  │  ├─ validate-image.ts
│  │  └─ types.ts
│  ├─ react/
│  │  ├─ ImageDropInput.tsx
│  │  ├─ PreviewDialog.tsx
│  │  ├─ use-image-drop-input.ts
│  │  └─ use-zoom.ts
│  ├─ upload/
│  │  ├─ create-multipart-uploader.ts
│  │  ├─ create-presigned-put-uploader.ts
│  │  ├─ create-raw-put-uploader.ts
│  │  └─ types.ts
│  ├─ index.ts
│  ├─ headless.ts
│  └─ style.css
├─ .gitignore
├─ cspell.json
├─ README.md
├─ README_en.md
├─ LICENSE
├─ package.json
├─ tsconfig.json
└─ tsdown.config.ts
```

## Design rules

- Runtime dependency target: **0** besides React peer dependency
- No UI framework coupling
- No cloud SDK bundling
- Public API must not leak Tailwind class contracts
- Upload adapter must be explicit, not inferred from URL text
- Persist `objectKey` or `publicUrl`; never derive public URL by string slicing upload URLs
- Single-image UX first; multi-image later or separate package
