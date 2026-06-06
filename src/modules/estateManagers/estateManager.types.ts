import { z } from 'zod';

const EstateRowSchema = z.object({
  id: z.uuid(),
  created_at: z.iso.datetime(),
  manager_id: z.uuid(),
  estate_id: z.uuid(),
});

export const EstateInsertSchema = EstateRowSchema.omit({
  id: true,
  created_at: true,
});

const EstateDeleteSchema = EstateRowSchema.pick({
  id: true,
});

export type EstateRow = z.infer<typeof EstateRowSchema>;
export type EstateInsert = z.infer<typeof EstateInsertSchema>;
export type EstateDelete = z.infer<typeof EstateDeleteSchema>;

export interface Database {
  public: {
    Tables: {
      estates: {
        Row: EstateRow;
        Insert: EstateInsert;
        Delete: EstateDelete;
      };
    };
  };
}

export const EstateWithDetailsSchema = z.array(
  z.object({
    id: z.uuid(),
    estate_id: z.uuid(),
    estate_name: z.string(),
    estate_location: z.string(),
    estate_state: z.string(),
    estate_status: z.string(),
    estate_logo_url: z.string(),
    estate_number_of_households: z.number().int().nonnegative(),
    estate_plan_id: z.uuid(),
    estate_subscription_plan_name: z.string().nullable(),
    estate_subscription_plan_household_limit: z.number().int().nonnegative(),
    estate_payment_id: z.uuid().nullable(),
    estate_payment_expires_at: z.iso.datetime().nullable(),
    estate_payment_paid_at: z.iso.datetime().nullable(),
    estate_payment_status: z.enum(['pending', 'paid', 'failed']).nullable(),
  }),
);

export type EstateWithDetails = z.infer<typeof EstateWithDetailsSchema>;
