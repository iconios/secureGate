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

export interface EstateWithDetails {
  id: string;
  estate_id: string;
  estates: {
    id: string;
    name: string;
    location: string;
    state: string;
    number_of_households: number;
    payment_expires_at: Date;
    status: string;
    logo_url: string;
    plan_id: string;
    subscription_plans: {
      name: string;
      household_limit: number;
    };
    payment_id: string;
    payments: {
      id: string;
      expires_at: Date;
      paid_at: Date;
      status: string;
    };
  };
}
