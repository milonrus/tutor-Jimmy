import { z } from 'zod';

export const CorrectionSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  type: z.string(),
  explanation: z.string().optional(),
  startIndex: z.number().optional(),
  endIndex: z.number().optional(),
});

export const CorrectionResponseSchema = z.object({
  corrections: z.array(CorrectionSchema).default([]),
});

export type Correction = z.infer<typeof CorrectionSchema>;
export type CorrectionResponse = z.infer<typeof CorrectionResponseSchema>;
