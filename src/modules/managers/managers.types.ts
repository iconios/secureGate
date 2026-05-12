import { z } from 'zod';

export const ManagersRowSchema = z
  .object({
    id: z.uuid(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime().nullable(),
    full_name: z.string().min(2).max(100).trim(),
    email: z.email().toLowerCase().trim(),
    phone: z.string(),
    password_hash: z.string(),
    last_login_at: z.iso.datetime().nullable(),
    is_verified: z.boolean().default(false),
    verified_at: z.iso.datetime().nullable(),
  })
  .strict();

export const ManagersInsertSchema = ManagersRowSchema.pick({
  full_name: true,
  email: true,
  phone: true,
  password_hash: true,
});

export const ManagersUpdateSchema = ManagersRowSchema.partial().pick({
  full_name: true,
  email: true,
  phone: true,
  password_hash: true,
  last_login_at: true,
  is_verified: true,
  verified_at: true,
});

export const ManagersDeleteSchema = ManagersRowSchema.pick({
  id: true,
}).strict();

export type ManagersRow = z.infer<typeof ManagersRowSchema>;
export type ManagersInsert = z.infer<typeof ManagersInsertSchema>;
export type ManagersUpdate = z.infer<typeof ManagersUpdateSchema>;
export type ManagersDelete = z.infer<typeof ManagersDeleteSchema>;

export interface Database {
  public: {
    Tables: {
      managers: {
        Row: ManagersRow;
        insert: ManagersInsert;
        update: ManagersUpdate;
        delete: ManagersDelete;
      };
    };
  };
}

export const NewManagerDataSchema = ManagersRowSchema.pick({
  full_name: true,
  email: true,
  phone: true,
}).extend({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    ),
});

export type NewManagerData = z.infer<typeof NewManagerDataSchema>;

export const emailVerificationRequestsSchema = z.object({
  id: z.uuid(),
  created_at: z.iso.datetime(),
  email: z.email(),
  purpose: z.enum(['account_registration', 'password_reset', 'verification_resend']),
  token_hash: z.string(),
  status: z.enum(['pending', 'used', 'expired', 'revoked']),
  sent_count: z.number().default(0),
  last_sent_at: z.iso.datetime().nullable(),
  next_allowed_at: z.iso.datetime().nullable(),
  window_started_at: z.iso.datetime(),
  window_expires_at: z.iso.datetime(),
  token_expires_at: z.iso.datetime(),
  used_at: z.iso.datetime().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
});

export type EmailVerificationRequest = z.infer<typeof emailVerificationRequestsSchema>;

export const verifyManagerDataSchema = NewManagerDataSchema.pick({
  email: true,
}).extend({
  token: z.string().min(1, 'Token is required'),
});

export type VerifyManagerData = z.infer<typeof verifyManagerDataSchema>;
