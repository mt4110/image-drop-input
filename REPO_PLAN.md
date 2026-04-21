# Repository plan

## Recommended repository name

`image-drop-input`

## Recommended title

`image-drop-input — React image input for pre-upload preview, validation, compression, paste, and signed uploads`

## Recommended structure

```txt
image-drop-input/
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     ├─ pages.yml
│     └─ release.yml
│  ├─ PULL_REQUEST_TEMPLATE/
│  │  └─ release.md
│  └─ pull_request_template.md
├─ examples/
│  ├─ vite/
│  ├─ rsbuild/
│  └─ shared/
│     └─ recipes/
├─ src/
│  ├─ core/
│  │  ├─ compress-image.ts
│  │  ├─ create-object-url.ts
│  │  ├─ decode-image.ts
│  │  ├─ get-image-metadata.ts
│  │  ├─ style-css.d.ts
│  │  ├─ validate-image.ts
│  │  └─ types.ts
│  ├─ react/
│  │  ├─ customization.ts
│  │  ├─ icons.tsx
│  │  ├─ ImageDropInput.tsx
│  │  ├─ PreviewDialog.tsx
│  │  ├─ use-image-drop-input.ts
│  │  └─ use-preview-dialog.ts
│  ├─ upload/
│  │  ├─ create-multipart-uploader.ts
│  │  ├─ create-presigned-put-uploader.ts
│  │  ├─ create-raw-put-uploader.ts
│  │  ├─ request.ts
│  │  └─ types.ts
│  ├─ index.ts
│  ├─ headless.ts
│  └─ style.css
├─ .gitignore
├─ .nvmrc
├─ .cspell.json
├─ CONTRIBUTING.md
├─ README.md
├─ README.ja.md
├─ README_en.md  # redirect to README.md
├─ RELEASING.md
├─ ROADMAP.md
├─ LICENSE
├─ package.json
├─ package-lock.json
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
- `src` stays persisted or shareable state; `previewSrc` stays temporary UI state
- `maxBytes` remains a compatibility limit for both source and transformed files
- Use `inputMaxBytes` / `outputMaxBytes` when source and transformed byte budgets differ
- Validation errors should keep stable codes and details so products can localize without parsing English strings
