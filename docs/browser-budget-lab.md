# Browser budget lab

`prepareImageToBudget()` uses browser image decoding and canvas encoding. Unit tests cover the solver logic with deterministic mocks; this lab verifies the public helper in real browser engines.

The lab is intentionally engine-specific:

```txt
Successful output must fit the requested budget.
Byte-identical output across browsers is not claimed.
```

## Command

Install the default Playwright browsers once:

```bash
npm run browser:budget-lab:install
```

Run the default Chromium and Firefox lab:

```bash
npm run browser:budget-lab
```

To include WebKit in an exploratory run:

```bash
npm run browser:budget-lab:install:webkit
npm run browser:budget-lab -- --browsers=chromium,firefox,webkit
```

The manual GitHub Actions workflow `Browser budget lab` runs the same script through `workflow_dispatch` and uploads JSON/Markdown artifacts.

## What the lab asserts

For successful cases, each selected browser must verify:

- `result.size <= outputMaxBytes`
- `result.file.size === result.size`
- `result.file.type` and `result.mimeType` match the requested output MIME type
- output dimensions stay within `maxWidth` and `maxHeight`
- output dimensions satisfy `minWidth` and `minHeight` when provided
- the solver does not upscale tiny input

For unreachable policies, each browser must throw `ImageBudgetError` with `budget_unreachable` and include encode attempts in `error.details.attempts`.

## What the lab does not assert

The lab does not assert:

- identical bytes across browser engines
- identical encoded sizes across browser engines
- identical attempt paths across browser engines
- provider/storage behavior

Browser encoders are allowed to differ. Treat the budget and MIME contract as the stable surface.

## Fixtures

The script generates fixtures inside the browser at runtime:

| Fixture | Purpose |
| --- | --- |
| Gradient PNG | Lossy WebP budget success with max dimensions. |
| High-frequency noise PNG | JPEG budget success against encoder-heavy input. |
| Transparent PNG | PNG resize-only behavior. |
| Tiny PNG | No-upscale behavior when max dimensions are larger than the input. |
| Noise PNG with impossible budget | Stable `budget_unreachable` behavior with attempts. |

## Current local run

Run date: 2026-05-08 JST.

Command:

```bash
npm run browser:budget-lab -- --browsers=chromium,firefox
```

| Engine | Case | Status | MIME | Size | Dimensions | Strategy | Attempts |
| --- | --- | --- | --- | ---: | --- | --- | ---: |
| Chromium | gradient to webp budget | passed | image/webp | 7462 | 700x467 | resize-and-quality-search | 1 |
| Chromium | noise to jpeg budget | passed | image/jpeg | 130776 | 600x400 | resize-and-quality-search | 1 |
| Chromium | transparent png resize | passed | image/png | 2543 | 256x256 | resize | 1 |
| Chromium | tiny image is not upscaled | passed | image/webp | 554 | 48x32 | quality-search | 1 |
| Chromium | budget-unreachable reports attempts | passed | image/webp | 0 | 0x0 | expected-error | 3 |
| Firefox | gradient to webp budget | passed | image/webp | 7230 | 700x467 | resize-and-quality-search | 1 |
| Firefox | noise to jpeg budget | passed | image/jpeg | 137082 | 600x400 | resize-and-quality-search | 1 |
| Firefox | transparent png resize | passed | image/png | 2574 | 256x256 | resize | 1 |
| Firefox | tiny image is not upscaled | passed | image/webp | 72 | 48x32 | quality-search | 1 |
| Firefox | budget-unreachable reports attempts | passed | image/webp | 0 | 0x0 | expected-error | 3 |

## Current WebKit exploratory run

Run date: 2026-05-08 JST.

Setup:

```bash
npm run browser:budget-lab:install:webkit
```

Command:

```bash
npm run browser:budget-lab -- --browsers=chromium,firefox,webkit --json-output=.artifacts/browser-budget-lab-webkit.json --markdown-output=.artifacts/browser-budget-lab-webkit.md
```

Result:

| Engine | Status | Finding | Claim impact |
| --- | --- | --- | --- |
| WebKit 26.4 (Playwright `webkit` v2272) | failed | `ImageBudgetError: This browser cannot encode image/webp.` | WebKit is not part of the verified browser budget matrix. Do not market WebKit byte-budget support yet. |

This is a useful negative result. It shows that the WebP policies used by the current lab are not portable to this WebKit environment, so the WebKit claim should stay unproven until a stable pass path exists or WebKit-specific policy limits are documented.

## CI policy

The browser lab starts as a manual workflow because browser downloads and encoder differences can be noisy. Promote it into normal PR or release gates only after repeated workflow runs show that it is stable enough for maintainer time.
