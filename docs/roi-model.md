# ROI model

The Zero Image-Processing Backend Pipeline claim should be measured, not assumed.

This model estimates the effect of moving resize, compression, and byte-budget fitting work into the browser while keeping auth, policy, presign, commit, cleanup, and audit on the server.

It is vendor-neutral. Provider invoices, rate cards, and transformation-unit definitions stay app-owned inputs.

## Calculator

Run the local calculator with fake or pilot-measured numbers:

```bash
npm run roi:estimate -- --monthly-uploads=50000 --average-raw-bytes=6000000 --average-prepared-bytes=750000 --raw-upload-backend-fraction=1 --average-server-processing-ms=450 --bandwidth-cost-per-gb=0.08 --storage-cost-per-gb-month=0.023 --transformation-cost-per-unit=0.001 --measured=averageRawBytes,averagePreparedBytes --format=markdown
```

The calculator uses decimal GB because most infrastructure invoices bill in GB-like units rather than binary GiB. Keep the same unit convention when comparing the output with invoices.

## Inputs

| Input | Meaning | Measured or assumed |
| --- | --- | --- |
| `monthlyUploads` | Count of image uploads for the target flow. | Prefer measured. |
| `averageRawBytes` | Average source file size before browser preparation. | Prefer measured. |
| `averagePreparedBytes` | Average output size after browser preparation. | Prefer measured. |
| `rawUploadBackendFraction` | Fraction of raw uploads that currently reach backend image processing. Defaults to `1`. | Assumption unless traced. |
| `averageServerProcessingMs` | Current backend/serverless image-processing time per upload. Defaults to `0`. | Prefer measured. |
| `averageTransformationUnitsPerUpload` | Average billable transformation units avoided per upload. Defaults to `1`. | Assumption unless traced. |
| `serverlessCostPerMs` | Effective cost per millisecond for current processing. | Assumption from invoice or rate card. |
| `transformationCostPerUnit` | Effective cost per transformation unit or call. | Assumption from invoice or rate card. |
| `storageCostPerGbMonth` | Cost for each avoidable GB-month. | Assumption from invoice or rate card. |
| `bandwidthCostPerGb` | Cost for each avoidable GB transferred. | Assumption from invoice or rate card. |
| `engineeringHoursSavedPerMonth` | Maintenance or support hours plausibly removed. | Assumption until a pilot proves it. |
| `engineeringHourlyCost` | Blended hourly cost used with saved hours. | App-owned assumption. |
| `abandonedDraftRate` | Fraction of drafts abandoned in the target flow. | Prefer measured. |
| `supportTicketCost` | Cost per related support ticket. | App-owned assumption. |

Mark measured fields explicitly:

```bash
--measured=monthlyUploads,averageRawBytes,averagePreparedBytes
```

Use `actualInvoices` and `beforeAfterInfrastructure` only after a pilot has invoice-backed before/after data:

```bash
--measured=monthlyUploads,averageRawBytes,averagePreparedBytes,beforeAfterInfrastructure,actualInvoices
```

## Output

The calculator reports:

- raw GB/month
- prepared GB/month
- avoided backend GB/month
- avoided backend processing hours/month
- avoided transformation units/month
- estimated monthly savings when cost assumptions are supplied
- confidence level
- measured inputs
- assumed inputs
- caveats

Draft support exposure is reported separately when `abandonedDraftRate` and `supportTicketCost` are provided. It is not counted as savings without incident data.

## Confidence

| Confidence | Rule |
| --- | --- |
| `low` | Raw/prepared byte averages are not both marked measured. |
| `medium` | Raw/prepared byte averages are measured, but pricing or infrastructure impact is still estimated. |
| `high` | Raw/prepared byte averages, before/after infrastructure data, and actual invoices are measured. |

Do not present `low` or `medium` confidence output as guaranteed savings. Even `high` confidence means the pilot inputs are evidence-backed; it does not mean the same result will hold across every form, tenant, or provider contract.

## Safe measurement fields

Measurement hooks should collect only operational metadata:

- `raw_bytes`
- `prepared_bytes`
- `reduction_ratio`
- `prepare_duration_ms`
- `decode_duration_ms`
- `encode_duration_ms`
- `upload_duration_ms`
- `draft_recovered`
- `draft_discarded`
- `commit_failed`
- `cleanup_failed`
- `browser_family`
- `policy_name`

Do not collect file contents, upload URLs, draft tokens, OPFS paths, EXIF values, user PII, or full object keys unless the app explicitly owns and approves that telemetry.

## Example

Fake pilot input:

```bash
npm run roi:estimate -- --monthly-uploads=100000 --average-raw-bytes=8000000 --average-prepared-bytes=900000 --raw-upload-backend-fraction=1 --average-server-processing-ms=350 --bandwidth-cost-per-gb=0.08 --storage-cost-per-gb-month=0.023 --transformation-cost-per-unit=0.001 --measured=averageRawBytes,averagePreparedBytes
```

This can show avoided bytes and estimated cost categories, but the caveats still matter:

- byte averages may be measured while provider rates remain assumed,
- storage savings apply only if raw originals or larger derivatives are currently retained,
- transformation savings depend on how the provider defines billable units,
- multi-derivative pipelines should supply `averageTransformationUnitsPerUpload` instead of using the default,
- invoices or vendor-specific rates are app-owned inputs.

## Pilot threshold

A pilot is worth continuing when it demonstrates at least two of these:

- 70% or greater byte reduction for the target form,
- no backend image processing in the target flow,
- measurable drop in transformation calls,
- draft recovery works in test cases,
- implementation finishes without provider lock-in.
