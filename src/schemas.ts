import { z } from 'zod';
import { config } from './config.js';

export const ParseRequestSchema = z.object({
  notice: z
    .string({
      required_error: 'Notice text is required',
      invalid_type_error: 'Notice must be a string'
    })
    .trim()
    .min(3, 'Notice must be at least 3 characters long')
    .max(config.maxNoticeLength, `Notice exceeds maximum length of ${config.maxNoticeLength} characters`)
});

export const BulkParseRequestSchema = z.object({
  notices: z
    .array(
      z
        .string({
          required_error: 'Notice item cannot be empty',
          invalid_type_error: 'Each notice must be a string'
        })
        .trim()
        .min(3, 'Notice item must be at least 3 characters')
        .max(config.maxNoticeLength, `Notice exceeds maximum length of ${config.maxNoticeLength} characters`)
    )
    .min(1, 'At least one notice must be provided')
    .max(config.maxBulkCount, `Cannot parse more than ${config.maxBulkCount} notices in a single bulk request`)
});

export const ParsedNoticeSchema = z.object({
  train: z
    .string()
    .regex(/^\d{4,6}$/, 'Train must be a valid 4 to 6 digit train number'),
  station: z
    .string()
    .min(2, 'Station must be at least 2 characters')
    .max(50, 'Station cannot exceed 50 characters'),
  expected_time: z
    .string()
    .min(3, 'Expected time must be specified'),
  delay_minutes: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional(),
  delay_text: z
    .string()
    .nullable()
    .optional(),
  reason: z
    .string()
    .nullable()
    .optional(),
  language: z.enum(['en', 'mr', 'hi', 'mixed']),
  raw_notice: z.string(),
  parsed_at: z.string().datetime()
});

export const ParseSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: ParsedNoticeSchema
});

export const BulkParseSuccessResponseSchema = z.object({
  success: z.literal(true),
  count: z.number().int().nonnegative(),
  data: z.array(ParsedNoticeSchema)
});
