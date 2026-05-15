#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const BYTES_PER_GB = 1_000_000_000;

const numericInputFields = new Set([
  'monthlyUploads',
  'averageRawBytes',
  'averagePreparedBytes',
  'rawUploadBackendFraction',
  'averageServerProcessingMs',
  'averageTransformationUnitsPerUpload',
  'serverlessCostPerMs',
  'transformationCostPerUnit',
  'storageCostPerGbMonth',
  'bandwidthCostPerGb',
  'engineeringHoursSavedPerMonth',
  'engineeringHourlyCost',
  'abandonedDraftRate',
  'supportTicketCost'
]);
const evidenceMeasuredFields = new Set([
  'actualInvoices',
  'beforeAfterInfrastructure'
]);
const allowedMeasuredFields = new Set([
  ...numericInputFields,
  ...evidenceMeasuredFields
]);

const requiredInputFields = [
  'monthlyUploads',
  'averageRawBytes',
  'averagePreparedBytes'
];

const measuredAliases = new Map([
  ['monthlyUploadCount', 'monthlyUploads'],
  ['uploadCount', 'monthlyUploads'],
  ['rawBytes', 'averageRawBytes'],
  ['raw_bytes', 'averageRawBytes'],
  ['averageRawBytes', 'averageRawBytes'],
  ['preparedBytes', 'averagePreparedBytes'],
  ['prepared_bytes', 'averagePreparedBytes'],
  ['averagePreparedBytes', 'averagePreparedBytes'],
  ['invoice', 'actualInvoices'],
  ['invoices', 'actualInvoices'],
  ['actualInvoices', 'actualInvoices'],
  ['beforeAfterInfrastructure', 'beforeAfterInfrastructure'],
  ['before_after_infrastructure', 'beforeAfterInfrastructure'],
  ['transformationCalls', 'beforeAfterInfrastructure'],
  ['transformation_calls', 'beforeAfterInfrastructure']
]);

const inputLabels = {
  monthlyUploads: 'Monthly uploads',
  averageRawBytes: 'Average raw bytes',
  averagePreparedBytes: 'Average prepared bytes',
  rawUploadBackendFraction: 'Raw upload backend fraction',
  averageServerProcessingMs: 'Average server processing ms',
  averageTransformationUnitsPerUpload: 'Average transformation units per upload',
  serverlessCostPerMs: 'Serverless cost per ms',
  transformationCostPerUnit: 'Transformation cost per unit',
  storageCostPerGbMonth: 'Storage cost per GB-month',
  bandwidthCostPerGb: 'Bandwidth cost per GB',
  engineeringHoursSavedPerMonth: 'Engineering hours saved per month',
  engineeringHourlyCost: 'Engineering hourly cost',
  abandonedDraftRate: 'Abandoned draft rate',
  supportTicketCost: 'Support ticket cost',
  actualInvoices: 'Actual invoices',
  beforeAfterInfrastructure: 'Before/after infrastructure data'
};

function camelize(value) {
  return value.replace(/[-_]([a-z0-9])/g, (_, character) =>
    character.toUpperCase()
  );
}

function roundNumber(value, digits = 9) {
  if (!Number.isFinite(value)) {
    return value;
  }

  const scale = 10 ** digits;
  const rounded = Math.round((value + Number.EPSILON) * scale) / scale;

  return Object.is(rounded, -0) ? 0 : rounded;
}

function bytesToGb(bytes) {
  return bytes / BYTES_PER_GB;
}

function isObjectRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMeasuredFields(fields = []) {
  if (!Array.isArray(fields)) {
    throw new Error('measuredFields must be an array.');
  }

  for (const [index, field] of fields.entries()) {
    if (typeof field !== 'string') {
      throw new Error(`measuredFields[${index}] must be a string.`);
    }
  }

  const normalizedFields = Array.from(
    new Set(
      fields
        .map((field) => field.trim())
        .filter(Boolean)
        .map(
          (field) =>
            measuredAliases.get(field) ??
            measuredAliases.get(camelize(field)) ??
            camelize(field)
        )
    )
  );

  for (const field of normalizedFields) {
    if (!allowedMeasuredFields.has(field)) {
      throw new Error(`Unknown measured field "${field}".`);
    }
  }

  return normalizedFields;
}

function assertFiniteNonNegative(input, field) {
  const value = input[field];

  if (value === undefined) {
    return;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a finite non-negative number.`);
  }
}

function assertFinitePositive(input, field) {
  const value = input[field];

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a finite positive number.`);
  }
}

function normalizeInput(input) {
  if (!isObjectRecord(input)) {
    throw new Error('ROI input must be an object.');
  }

  const normalized = {
    ...input,
    rawUploadBackendFraction: input.rawUploadBackendFraction ?? 1,
    averageServerProcessingMs: input.averageServerProcessingMs ?? 0,
    averageTransformationUnitsPerUpload:
      input.averageTransformationUnitsPerUpload ?? 1
  };

  for (const field of requiredInputFields) {
    if (normalized[field] === undefined) {
      throw new Error(`${field} is required.`);
    }
  }

  for (const field of numericInputFields) {
    assertFiniteNonNegative(normalized, field);
  }

  for (const field of requiredInputFields) {
    assertFinitePositive(normalized, field);
  }

  if (normalized.rawUploadBackendFraction > 1) {
    throw new Error('rawUploadBackendFraction must be between 0 and 1.');
  }

  if (
    normalized.abandonedDraftRate !== undefined &&
    normalized.abandonedDraftRate > 1
  ) {
    throw new Error('abandonedDraftRate must be between 0 and 1.');
  }

  return normalized;
}

function assertMeasuredInputsHaveValues(input, measuredInputs) {
  for (const field of measuredInputs) {
    if (numericInputFields.has(field) && input[field] === undefined) {
      throw new Error(
        `Measured field "${field}" requires a corresponding input value.`
      );
    }
  }
}

function getConfidence(measuredInputs) {
  const measured = new Set(measuredInputs);
  const hasMeasuredBytes =
    measured.has('averageRawBytes') && measured.has('averagePreparedBytes');
  const hasMeasuredInfrastructure = measured.has('beforeAfterInfrastructure');
  const hasActualInvoices = measured.has('actualInvoices');

  if (hasMeasuredBytes && hasMeasuredInfrastructure && hasActualInvoices) {
    return 'high';
  }

  if (hasMeasuredBytes) {
    return 'medium';
  }

  return 'low';
}

function getAssumedInputs(input, measuredInputs) {
  const measured = new Set(measuredInputs);

  return Object.keys(input)
    .filter((field) => numericInputFields.has(field))
    .filter((field) => !measured.has(field))
    .sort();
}

function hasOwnInput(input, field) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function buildCaveats(input, providedInput, measuredInputs, result) {
  const caveats = ['This is a planning estimate, not a guarantee of savings.'];
  const measured = new Set(measuredInputs);
  const measuredBytes =
    measured.has('averageRawBytes') && measured.has('averagePreparedBytes');

  if (!measuredBytes) {
    caveats.push(
      'Raw and prepared byte averages are not both marked measured; confirm them with a pilot before using the estimate externally.'
    );
  }

  if (result.estimatedMonthlySavings === undefined) {
    caveats.push(
      'No complete cost assumptions were supplied, so estimatedMonthlySavings is omitted.'
    );
  }

  if (input.averagePreparedBytes > input.averageRawBytes) {
    caveats.push(
      'Prepared bytes exceed raw bytes; the pipeline may improve policy fit or privacy, but byte savings are not shown by these inputs.'
    );
  }

  if (input.storageCostPerGbMonth !== undefined) {
    caveats.push(
      'Storage savings only apply when the current system stores raw originals or larger derivatives for the measured retention window.'
    );
  }

  if (
    input.serverlessCostPerMs !== undefined &&
    input.averageServerProcessingMs === 0
  ) {
    caveats.push(
      'Serverless cost per ms was supplied, but averageServerProcessingMs is zero, so processing savings are zero.'
    );
  }

  if (
    input.transformationCostPerUnit !== undefined &&
    !hasOwnInput(providedInput, 'averageTransformationUnitsPerUpload')
  ) {
    caveats.push(
      'Transformation savings assume one transformation unit per upload unless averageTransformationUnitsPerUpload is supplied.'
    );
  }

  if (
    (input.engineeringHoursSavedPerMonth === undefined) !==
    (input.engineeringHourlyCost === undefined)
  ) {
    caveats.push(
      'Engineering savings require both engineeringHoursSavedPerMonth and engineeringHourlyCost.'
    );
  }

  if (
    input.engineeringHoursSavedPerMonth !== undefined &&
    input.engineeringHourlyCost !== undefined &&
    (!measured.has('engineeringHoursSavedPerMonth') ||
      !measured.has('engineeringHourlyCost'))
  ) {
    caveats.push(
      'Engineering savings are assumptions unless both engineering fields are marked measured.'
    );
  }

  if (input.rawUploadBackendFraction < 1) {
    caveats.push(
      'Only the raw-upload fraction that currently reaches backend processing is counted as avoidable backend work.'
    );
  }

  if (result.estimatedMonthlyDraftSupportExposure !== undefined) {
    caveats.push(
      'Draft support exposure is reported separately and is not counted as savings without incident data.'
    );
  }

  caveats.push(
    'Vendor rates, transformation-unit definitions, and invoices are app-owned inputs; this calculator does not contact provider APIs or require secrets.'
  );

  return caveats;
}

export function estimateImagePipelineRoi(input, options = {}) {
  const normalized = normalizeInput(input);
  const measuredInputs = normalizeMeasuredFields(options.measuredFields ?? []);
  assertMeasuredInputsHaveValues(input, measuredInputs);
  const monthlyUploads = normalized.monthlyUploads;
  const rawUploadBackendFraction = normalized.rawUploadBackendFraction;
  const rawGbPerMonth = bytesToGb(monthlyUploads * normalized.averageRawBytes);
  const preparedGbPerMonth = bytesToGb(
    monthlyUploads * normalized.averagePreparedBytes
  );
  const avoidableRawGb = rawGbPerMonth * rawUploadBackendFraction;
  const avoidablePreparedGb = preparedGbPerMonth * rawUploadBackendFraction;
  const avoidedGbPerMonth = avoidableRawGb - avoidablePreparedGb;
  const avoidedBackendProcessingHours =
    (monthlyUploads *
      rawUploadBackendFraction *
      normalized.averageServerProcessingMs) /
    3_600_000;
  const avoidedTransformationUnits =
    monthlyUploads *
    rawUploadBackendFraction *
    normalized.averageTransformationUnitsPerUpload;
  const costBreakdown = {};

  if (normalized.bandwidthCostPerGb !== undefined) {
    costBreakdown.bandwidth = avoidedGbPerMonth * normalized.bandwidthCostPerGb;
  }

  if (normalized.storageCostPerGbMonth !== undefined) {
    costBreakdown.storage =
      avoidedGbPerMonth * normalized.storageCostPerGbMonth;
  }

  if (
    normalized.serverlessCostPerMs !== undefined &&
    normalized.averageServerProcessingMs > 0
  ) {
    costBreakdown.serverlessProcessing =
      monthlyUploads *
      rawUploadBackendFraction *
      normalized.averageServerProcessingMs *
      normalized.serverlessCostPerMs;
  }

  if (normalized.transformationCostPerUnit !== undefined) {
    costBreakdown.transformations =
      avoidedTransformationUnits * normalized.transformationCostPerUnit;
  }

  if (
    normalized.engineeringHoursSavedPerMonth !== undefined &&
    normalized.engineeringHourlyCost !== undefined
  ) {
    costBreakdown.engineering =
      normalized.engineeringHoursSavedPerMonth *
      normalized.engineeringHourlyCost;
  }

  const estimatedMonthlySavings =
    Object.keys(costBreakdown).length > 0
      ? roundNumber(
          Object.values(costBreakdown).reduce(
            (total, value) => total + value,
            0
          ),
          2
        )
      : undefined;
  const roundedCostBreakdown = Object.fromEntries(
    Object.entries(costBreakdown).map(([key, value]) => [
      key,
      roundNumber(value, 2)
    ])
  );
  const estimatedMonthlyDraftSupportExposure =
    normalized.abandonedDraftRate !== undefined &&
    normalized.supportTicketCost !== undefined
      ? roundNumber(
          monthlyUploads *
            normalized.abandonedDraftRate *
            normalized.supportTicketCost,
          2
        )
      : undefined;
  const result = {
    rawGbPerMonth: roundNumber(rawGbPerMonth),
    preparedGbPerMonth: roundNumber(preparedGbPerMonth),
    avoidedGbPerMonth: roundNumber(avoidedGbPerMonth),
    avoidedBackendProcessingHours: roundNumber(avoidedBackendProcessingHours),
    avoidedTransformationUnits: roundNumber(avoidedTransformationUnits),
    estimatedMonthlySavings,
    estimatedMonthlyDraftSupportExposure,
    confidence: getConfidence(measuredInputs),
    measuredInputs,
    assumedInputs: getAssumedInputs(normalized, measuredInputs),
    costBreakdown: roundedCostBreakdown,
    caveats: []
  };

  result.caveats = buildCaveats(normalized, input, measuredInputs, result);

  if (result.estimatedMonthlySavings === undefined) {
    delete result.estimatedMonthlySavings;
  }

  if (result.estimatedMonthlyDraftSupportExposure === undefined) {
    delete result.estimatedMonthlyDraftSupportExposure;
  }

  return result;
}

export function parseRoiArgs(argv) {
  const input = {};
  let format = 'json';
  let measuredFields = [];

  if (argv.includes('--help') || argv.includes('-h')) {
    return {
      input,
      measuredFields,
      format,
      showHelp: true
    };
  }

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      throw new Error(`Unsupported argument "${arg}". Use --name=value flags.`);
    }

    const separatorIndex = arg.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`Missing value for "${arg}". Use --name=value.`);
    }

    const rawName = arg.slice(2, separatorIndex);
    if (rawName === '') {
      throw new Error('Argument name is required.');
    }

    const rawValue = arg.slice(separatorIndex + 1);
    const name = camelize(rawName);

    if (name === 'format') {
      if (rawValue === '') {
        throw new Error('--format requires json or markdown.');
      }

      if (rawValue !== 'json' && rawValue !== 'markdown') {
        throw new Error('--format must be json or markdown.');
      }

      format = rawValue;
      continue;
    }

    if (name === 'measured' || name === 'measuredInputs') {
      if (rawValue === '') {
        throw new Error('--measured requires a comma-separated field list.');
      }

      measuredFields = rawValue.split(',').filter(Boolean);
      continue;
    }

    if (!numericInputFields.has(name)) {
      throw new Error(`Unknown ROI input "${rawName}".`);
    }

    const numericValue = Number(rawValue);

    if (rawValue === '' || !Number.isFinite(numericValue)) {
      throw new Error(`${rawName} must be a number.`);
    }

    input[name] = numericValue;
  }

  return {
    input,
    measuredFields,
    format,
    showHelp: false
  };
}

function formatMoney(value) {
  if (value === undefined) {
    return 'not estimated';
  }

  if (value < 0) {
    return `-$${Math.abs(value).toFixed(2)}`;
  }

  return `$${value.toFixed(2)}`;
}

function formatNumber(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  const absoluteValue = Math.abs(value);

  return value.toLocaleString('en-US', {
    maximumFractionDigits: absoluteValue > 0 && absoluteValue < 0.001 ? 9 : 6,
    minimumFractionDigits: 0,
    useGrouping: false
  });
}

export function formatRoiMarkdown(result) {
  const costRows = Object.entries(result.costBreakdown);
  const caveats = result.caveats.map((caveat) => `- ${caveat}`).join('\n');
  const measuredRows =
    result.measuredInputs.length === 0
      ? '- None marked measured.'
      : result.measuredInputs
          .map((field) => `- ${inputLabels[field] ?? field}`)
          .join('\n');
  const assumedRows = result.assumedInputs
    .map((field) => `- ${inputLabels[field] ?? field}`)
    .join('\n') || '- None.';
  const costBreakdown =
    costRows.length === 0
      ? 'No complete cost assumptions supplied.'
      : costRows
          .map(([key, value]) => `- ${key}: ${formatMoney(value)}`)
          .join('\n');

  return `# Image pipeline ROI estimate

| Metric | Value |
| --- | ---: |
| Raw GB/month | ${formatNumber(result.rawGbPerMonth)} |
| Prepared GB/month | ${formatNumber(result.preparedGbPerMonth)} |
| Avoided backend GB/month | ${formatNumber(result.avoidedGbPerMonth)} |
| Avoided backend processing hours/month | ${formatNumber(result.avoidedBackendProcessingHours)} |
| Avoided transformation units/month | ${formatNumber(result.avoidedTransformationUnits)} |
| Estimated monthly savings | ${formatMoney(result.estimatedMonthlySavings)} |
| Confidence | ${result.confidence} |

## Cost Breakdown

${costBreakdown}

## Measured Inputs

${measuredRows}

## Assumed Inputs

${assumedRows}

## Caveats

${caveats}
`;
}

function helpText() {
  return `Usage:
  npm run roi:estimate -- --monthly-uploads=50000 --average-raw-bytes=6000000 --average-prepared-bytes=750000

Common options:
  --raw-upload-backend-fraction=1
  --average-server-processing-ms=450
  --average-transformation-units-per-upload=1
  --bandwidth-cost-per-gb=0.08
  --storage-cost-per-gb-month=0.023
  --serverless-cost-per-ms=0.0000000167
  --transformation-cost-per-unit=0.001
  --measured=averageRawBytes,averagePreparedBytes
  --format=json|markdown

All costs are app-owned assumptions. The calculator does not contact provider APIs.`;
}

function runCli(argv) {
  try {
    const { input, measuredFields, format, showHelp } = parseRoiArgs(argv);

    if (showHelp) {
      console.log(helpText());
      return;
    }

    const result = estimateImagePipelineRoi(input, { measuredFields });

    if (format === 'markdown') {
      console.log(formatRoiMarkdown(result));
      return;
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('');
    console.error(helpText());
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2));
}
