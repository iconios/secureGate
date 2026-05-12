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
  payment_expires_at: z.iso.datetime().nullable(),
  status: z.enum(['active', 'inactive', 'pending', 'expired']).default('pending'),
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
