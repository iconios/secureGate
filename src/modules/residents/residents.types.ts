import { z } from 'zod';

export const GetAllNonPrincipalResidentsByEstateSchema = z
  .object({
    userId: z.string().trim().min(1),
    estateId: z.string().trim().min(1),
    searchTerm: z.string().trim().optional().default(''),
  })
  .strict();

export type GetAllNonPrincipalResidentsByEstateInput = z.infer<
  typeof GetAllNonPrincipalResidentsByEstateSchema
>;
