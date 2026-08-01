import { z } from 'zod';

export const GetAllNonPrincipalResidentsByEstateSchema = z
  .object({
    userId: z.string().trim().min(1),
    estateId: z.string().trim().min(1),
    page: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(10),
    searchTerm: z.string().trim().optional().default(''),
  })
  .strict();

export type GetAllNonPrincipalResidentsByEstateInput = z.input<
  typeof GetAllNonPrincipalResidentsByEstateSchema
>;
