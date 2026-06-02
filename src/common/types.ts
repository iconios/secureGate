import { z } from 'zod';

export const tokenPayloadSchema = z
  .object({
    id: z.uuid(),
    full_name: z.string(),
    email: z.email(),
    role: z.enum(['manager', 'security_guard', 'admin', 'resident']),
  })
  .strict();

export type tokenPayload = z.infer<typeof tokenPayloadSchema>;
