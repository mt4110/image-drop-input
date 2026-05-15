import { describe, expect, it } from 'vitest';
import {
  estimateImagePipelineRoi,
  formatRoiMarkdown,
  parseRoiArgs
} from '../../docs/tools/roi-calculator.mjs';

describe('estimateImagePipelineRoi', () => {
  it('rejects non-object input', () => {
    expect(() => estimateImagePipelineRoi(null)).toThrow(
      'ROI input must be an object.'
    );
  });

  it('estimates avoided bytes, processing, and cost categories', () => {
    const result = estimateImagePipelineRoi(
      {
        monthlyUploads: 1000,
        averageRawBytes: 10_000_000,
        averagePreparedBytes: 2_000_000,
        rawUploadBackendFraction: 1,
        averageServerProcessingMs: 500,
        averageTransformationUnitsPerUpload: 2,
        bandwidthCostPerGb: 0.1,
        serverlessCostPerMs: 0.00000002,
        transformationCostPerUnit: 0.001
      },
      {
        measuredFields: ['averageRawBytes', 'averagePreparedBytes']
      }
    );

    expect(result.rawGbPerMonth).toBe(10);
    expect(result.preparedGbPerMonth).toBe(2);
    expect(result.avoidedGbPerMonth).toBe(8);
    expect(result.avoidedBackendProcessingHours).toBeCloseTo(0.138889, 6);
    expect(result.costBreakdown).toEqual({
      bandwidth: 0.8,
      serverlessProcessing: 0.01,
      transformations: 2
    });
    expect(result.estimatedMonthlySavings).toBe(2.81);
    expect(result.confidence).toBe('medium');
    expect(result.avoidedTransformationUnits).toBe(2000);
  });

  it('keeps savings undefined when no complete cost inputs are supplied', () => {
    const result = estimateImagePipelineRoi({
      monthlyUploads: 100,
      averageRawBytes: 5_000_000,
      averagePreparedBytes: 1_000_000
    });

    expect(result.estimatedMonthlySavings).toBeUndefined();
    expect(result.confidence).toBe('low');
    expect(result.caveats).toContain(
      'No complete cost assumptions were supplied, so estimatedMonthlySavings is omitted.'
    );
  });

  it('warns when engineering cost inputs are incomplete', () => {
    const result = estimateImagePipelineRoi({
      monthlyUploads: 100,
      averageRawBytes: 5_000_000,
      averagePreparedBytes: 1_000_000,
      engineeringHoursSavedPerMonth: 2
    });

    expect(result.estimatedMonthlySavings).toBeUndefined();
    expect(result.caveats).toContain(
      'Engineering savings require both engineeringHoursSavedPerMonth and engineeringHourlyCost.'
    );
  });

  it('requires invoice and infrastructure evidence for high confidence', () => {
    const result = estimateImagePipelineRoi(
      {
        monthlyUploads: 100,
        averageRawBytes: 5_000_000,
        averagePreparedBytes: 1_000_000
      },
      {
        measuredFields: [
          'averageRawBytes',
          'averagePreparedBytes',
          'beforeAfterInfrastructure',
          'actualInvoices'
        ]
      }
    );

    expect(result.confidence).toBe('high');
  });

  it('rejects unknown measured fields', () => {
    expect(() =>
      estimateImagePipelineRoi(
        {
          monthlyUploads: 100,
          averageRawBytes: 5_000_000,
          averagePreparedBytes: 1_000_000
        },
        {
          measuredFields: ['averageRawByte']
        }
      )
    ).toThrow('Unknown measured field "averageRawByte".');
  });

  it('rejects non-array measured field options', () => {
    expect(() =>
      estimateImagePipelineRoi(
        {
          monthlyUploads: 100,
          averageRawBytes: 5_000_000,
          averagePreparedBytes: 1_000_000
        },
        {
          measuredFields: 'averageRawBytes'
        }
      )
    ).toThrow('measuredFields must be an array.');
  });

  it('rejects measured numeric fields without matching input values', () => {
    expect(() =>
      estimateImagePipelineRoi(
        {
          monthlyUploads: 100,
          averageRawBytes: 5_000_000,
          averagePreparedBytes: 1_000_000
        },
        {
          measuredFields: ['averageServerProcessingMs']
        }
      )
    ).toThrow(
      'Measured field "averageServerProcessingMs" requires a corresponding input value.'
    );
  });

  it('rejects zero required inputs', () => {
    expect(() =>
      estimateImagePipelineRoi({
        monthlyUploads: 0,
        averageRawBytes: 5_000_000,
        averagePreparedBytes: 1_000_000
      })
    ).toThrow('monthlyUploads must be a finite positive number.');
  });

  it('reports draft support exposure separately from savings', () => {
    const result = estimateImagePipelineRoi({
      monthlyUploads: 1000,
      averageRawBytes: 5_000_000,
      averagePreparedBytes: 1_000_000,
      abandonedDraftRate: 0.05,
      supportTicketCost: 20,
      bandwidthCostPerGb: 0.1
    });

    expect(result.estimatedMonthlyDraftSupportExposure).toBe(1000);
    expect(result.estimatedMonthlySavings).toBe(0.4);
  });
});

describe('parseRoiArgs', () => {
  it('parses kebab-case flags and measured fields', () => {
    const parsed = parseRoiArgs([
      '--monthly-uploads=1000',
      '--average-raw-bytes=5000000',
      '--average-prepared-bytes=1000000',
      '--measured=raw_bytes,prepared_bytes',
      '--format=markdown'
    ]);

    expect(parsed.input).toEqual({
      monthlyUploads: 1000,
      averageRawBytes: 5_000_000,
      averagePreparedBytes: 1_000_000
    });
    expect(parsed.measuredFields).toEqual(['raw_bytes', 'prepared_bytes']);
    expect(parsed.format).toBe('markdown');
  });

  it('rejects flags without explicit values', () => {
    expect(() => parseRoiArgs(['--monthly-uploads'])).toThrow(
      'Missing value for "--monthly-uploads". Use --name=value.'
    );
  });

  it('lets help short-circuit other arguments', () => {
    expect(parseRoiArgs(['--help', '--bad'])).toEqual({
      input: {},
      measuredFields: [],
      format: 'json',
      showHelp: true
    });
  });

  it('rejects empty argument names', () => {
    expect(() => parseRoiArgs(['--=1'])).toThrow(
      'Argument name is required.'
    );
  });
});

describe('formatRoiMarkdown', () => {
  it('renders a shareable estimate without secrets', () => {
    const result = estimateImagePipelineRoi({
      monthlyUploads: 100,
      averageRawBytes: 5_000_000,
      averagePreparedBytes: 1_000_000
    });
    const markdown = formatRoiMarkdown(result);

    expect(markdown).toContain('# Image pipeline ROI estimate');
    expect(markdown).toContain('Vendor rates');
    expect(markdown).toContain('Raw GB/month | 0.5');
  });

  it('keeps tiny GB values distinguishable in markdown output', () => {
    const result = estimateImagePipelineRoi({
      monthlyUploads: 1,
      averageRawBytes: 1000,
      averagePreparedBytes: 500
    });
    const markdown = formatRoiMarkdown(result);

    expect(markdown).toContain('Raw GB/month | 0.000001');
    expect(markdown).toContain('Prepared GB/month | 0.0000005');
    expect(markdown).toContain('Avoided backend GB/month | 0.0000005');
  });
});
