import { z } from 'zod';

export const SubscriptionPlanRowSchema = z
  .object({
    id: z.uuid(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime().nullable(),
    name: z.string(),
    period_in_days: z.iso.datetime(),
    price_per_period: z.iso.datetime(),
    status: z.string(),
    household_limit: z.number().int().min(0),
  })
  .strict();

export type SubscriptionPlanRow = z.infer<typeof SubscriptionPlanRowSchema>;
