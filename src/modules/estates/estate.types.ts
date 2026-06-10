import { UUID } from 'crypto';
import { z } from 'zod';

const EstateRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  created_at: z.iso.datetime(),
  location: z.string(),
  state: z.string(),
  plan_id: z.uuid(),
  payment_id: z.uuid().nullable(),
  updated_at: z.iso.datetime().nullable(),
  number_of_households: z.number().int().nonnegative().default(0),
  status: z.enum(['active', 'inactive', 'pending', 'expired']).default('pending'),
  logoUrl: z.string(),
});

export const EstateInsertSchema = EstateRowSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

const EstateUpdateSchema = EstateRowSchema.partial().omit({
  id: true,
  created_at: true,
  updated_at: true,
});

const EstateDeleteSchema = EstateRowSchema.pick({
  id: true,
});

export type EstateRow = z.infer<typeof EstateRowSchema>;
export type EstateInsert = z.infer<typeof EstateInsertSchema>;
export type EstateUpdate = z.infer<typeof EstateUpdateSchema>;
export type EstateDelete = z.infer<typeof EstateDeleteSchema>;

export interface Database {
  public: {
    Tables: {
      estates: {
        Row: EstateRow;
        Insert: EstateInsert;
        Update: EstateUpdate;
        Delete: EstateDelete;
      };
    };
  };
}

export interface IPaymentEstateManagerDetailsArgs {
  p_payment_id: string;
  p_estate_id: string;
  p_plan_id: string;
  p_manager_id: string;
}

export interface IPaymentEstateManagerDetails {
  payment_expires_at: string;
  estate_name: string;
  plan_name: string;
  currency: string;
  full_name: string;
  period: string;
}
