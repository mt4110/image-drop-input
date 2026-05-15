# Browser Budget Lab

`prepareImageInBrowserPipeline()` uses browser image decoding, canvas encoding, and a worker-first pipeline. Unit tests cover deterministic solver behavior with mocks; this lab verifies the public helper in real browser engines.

The lab is intentionally engine-specific:

```txt
Successful output must fit the requested budget.
Byte-identical output across browsers is not claimed.
```

## Command

Install the Chromium and Firefox browsers once:

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

## What The Lab Asserts

For successful cases, each selected browser must verify:

- `result.size <= outputMaxBytes`
- `result.file.size === result.size`
- `result.file.type` and `result.mimeType` match the requested output MIME type
- output dimensions stay within `maxWidth` and `maxHeight`
- output dimensions satisfy `minWidth` and `minHeight` when provided
- the solver does not upscale tiny input
- the pipeline reports selected mode, processing time, byte reduction, and sampled main-thread blocking
- sampled main-thread blocking stays at or below 120 ms for the selected profiles

For unreachable policies, each browser must throw `ImageBudgetError` with `budget_unreachable` and include encode attempts in `error.details.attempts`.

## Profiles

Each browser runs both profiles:

| Profile | Viewport | Purpose |
| --- | --- | --- |
| Desktop | 1280x900 | Default workstation behavior. |
| Mobile | 390x844 at 3x device scale | Mobile-sized viewport and tighter responsiveness signal. |

The profiles are evidence buckets, not a claim that all mobile devices have identical encoder speed or memory behavior.

## What The Lab Does Not Assert

The lab does not assert:

- identical bytes across browser engines
- identical encoded sizes across browser engines
- identical attempt paths across browser engines
- provider/storage behavior
- AVIF/Wasm codec support

Browser encoders are allowed to differ. Treat the budget, MIME, worker/fallback mode, and stable error contract as the stable surface.

## Fixtures

The script generates fixtures inside the browser at runtime:

| Fixture | Purpose |
| --- | --- |
| Gradient PNG | Lossy WebP budget success with max dimensions. |
| High-frequency noise PNG | JPEG budget success against encoder-heavy input. |
| Transparent PNG | PNG resize-only behavior. |
| Tiny PNG | No-upscale behavior when max dimensions are larger than the input. |
| Noise PNG with impossible budget | Stable `budget_unreachable` behavior with attempts. |

## Current Local Run

Run date: 2026-05-15 JST.

Command:

```bash
npm run browser:budget-lab -- --browsers=chromium,firefox --json-output=.artifacts/browser-budget-lab-phase3.json --markdown-output=.artifacts/browser-budget-lab-phase3.md
```

| Engine | Profile | Case | Status | Mode | MIME | Size | Bytes saved | Time ms | Main block ms | Dimensions | Strategy | Attempts |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | ---: |
| Chromium | desktop | gradient to webp budget | passed | worker | image/webp | 7462 | 1101165 | 25 | 0 | 700x467 | resize-and-quality-search | 1 |
| Chromium | desktop | noise to jpeg budget | passed | worker | image/jpeg | 130776 | 0 | 7 | 0 | 600x400 | resize-and-quality-search | 1 |
| Chromium | desktop | transparent png resize | passed | worker | image/png | 2543 | 4708 | 5 | 0 | 256x256 | resize | 1 |
| Chromium | desktop | tiny image is not upscaled | passed | worker | image/webp | 554 | 0 | 5 | 0 | 48x32 | quality-search | 1 |
| Chromium | desktop | budget-unreachable reports attempts | passed | worker | image/webp | 0 | 5694 | 37 | 0 | 0x0 | expected-error | 3 |
| Chromium | mobile | gradient to webp budget | passed | worker | image/webp | 7462 | 1101165 | 25 | 0 | 700x467 | resize-and-quality-search | 1 |
| Chromium | mobile | noise to jpeg budget | passed | worker | image/jpeg | 130776 | 0 | 7 | 0 | 600x400 | resize-and-quality-search | 1 |
| Chromium | mobile | transparent png resize | passed | worker | image/png | 2543 | 4708 | 5 | 0 | 256x256 | resize | 1 |
| Chromium | mobile | tiny image is not upscaled | passed | worker | image/webp | 554 | 0 | 4 | 0 | 48x32 | quality-search | 1 |
| Chromium | mobile | budget-unreachable reports attempts | passed | worker | image/webp | 0 | 5694 | 38 | 0 | 0x0 | expected-error | 3 |
| Firefox | desktop | gradient to webp budget | passed | worker | image/webp | 7230 | 295847 | 26 | 0 | 700x467 | resize-and-quality-search | 1 |
| Firefox | desktop | noise to jpeg budget | passed | worker | image/jpeg | 137082 | 0 | 12 | 0 | 600x400 | resize-and-quality-search | 1 |
| Firefox | desktop | transparent png resize | passed | worker | image/png | 2574 | 5770 | 9 | 0 | 256x256 | resize | 1 |
| Firefox | desktop | tiny image is not upscaled | passed | worker | image/webp | 72 | 90 | 8 | 0 | 48x32 | quality-search | 1 |
| Firefox | desktop | budget-unreachable reports attempts | passed | worker | image/webp | 0 | 5539 | 38 | 0 | 0x0 | expected-error | 3 |
| Firefox | mobile | gradient to webp budget | passed | worker | image/webp | 7230 | 295847 | 26 | 0 | 700x467 | resize-and-quality-search | 1 |
| Firefox | mobile | noise to jpeg budget | passed | worker | image/jpeg | 137082 | 0 | 12 | 0 | 600x400 | resize-and-quality-search | 1 |
| Firefox | mobile | transparent png resize | passed | worker | image/png | 2574 | 5770 | 10 | 0 | 256x256 | resize | 1 |
| Firefox | mobile | tiny image is not upscaled | passed | worker | image/webp | 72 | 90 | 7 | 0 | 48x32 | quality-search | 1 |
| Firefox | mobile | budget-unreachable reports attempts | passed | worker | image/webp | 0 | 5539 | 39 | 0 | 0x0 | expected-error | 3 |

## Current WebKit Exploratory Run

Run date: 2026-05-15 JST.

Command:

```bash
npm run browser:budget-lab -- --browsers=webkit --json-output=.artifacts/browser-budget-lab-phase3-webkit.json --markdown-output=.artifacts/browser-budget-lab-phase3-webkit.md
```

Result:

| Engine | Status | Finding | Claim impact |
| --- | --- | --- | --- |
| WebKit 26.4 (Playwright `webkit` v2272) | failed | `ImageBudgetError: This browser cannot encode image/webp.` | WebKit is not part of the verified browser budget matrix. Do not market WebKit byte-budget support yet. |

This is a useful negative result. It shows that the WebP policies used by the current lab are not portable to this WebKit environment, so the WebKit claim should stay unproven until a stable pass path exists or WebKit-specific policy limits are documented.

## CI Policy

The browser lab stays a manual workflow because browser downloads and encoder differences can be noisy. Promote it into normal PR or release gates only after repeated workflow runs show that it is stable enough for maintainer time.
