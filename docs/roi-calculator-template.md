# ROI calculator template

Use this worksheet before sharing a cost-savings claim. Replace fake values with pilot data where possible.

| Field | Value | Source |
| --- | ---: | --- |
| Monthly uploads | `50000` | Measured analytics or assumption |
| Average raw bytes | `6000000` | Pilot sample |
| Average prepared bytes | `750000` | Pilot sample |
| Raw upload backend fraction | `1` | Architecture review |
| Average server processing ms | `450` | Logs or trace sample |
| Average transformation units per upload | `1` | Transformation logs or assumption |
| Bandwidth cost per GB | `0.08` | Invoice or rate card |
| Storage cost per GB-month | `0.023` | Invoice or rate card |
| Transformation cost per unit | `0.001` | Invoice or rate card |
| Measured fields | `averageRawBytes,averagePreparedBytes` | Pilot measurement |

Run:

```bash
npm run roi:estimate -- --monthly-uploads=50000 --average-raw-bytes=6000000 --average-prepared-bytes=750000 --raw-upload-backend-fraction=1 --average-server-processing-ms=450 --average-transformation-units-per-upload=1 --bandwidth-cost-per-gb=0.08 --storage-cost-per-gb-month=0.023 --transformation-cost-per-unit=0.001 --measured=averageRawBytes,averagePreparedBytes --format=markdown
```

Before using the result externally, answer:

- Which fields are measured rather than assumed?
- Which provider rates came from actual invoices?
- Does the current system store raw originals, larger derivatives, or both?
- Are transformation units billed per upload, per derivative, per credit, or by another provider-specific rule?
- Is backend image processing actually removed, or only moved to a different service?
- Which caveats should be shown beside the estimate?
