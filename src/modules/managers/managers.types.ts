import { z } from 'zod';
import { termiiPhoneSchema } from '../houseHolds/households.types.js';

const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(32, 'Password must be at most 32 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

export const ManagersRowSchema = z
  .object({
    id: z.uuid(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime().nullable(),
    full_name: z.string().min(2).max(100).trim(),
    email: z.email().toLowerCase().trim(),
    phone: termiiPhoneSchema,
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
  code_hash: z.string(),
  status: z.enum(['pending', 'used', 'expired', 'revoked']),
  sent_count: z.number().default(0),
  last_sent_at: z.iso.datetime().nullable(),
  next_allowed_at: z.iso.datetime().nullable(),
  window_started_at: z.iso.datetime(),
  window_expires_at: z.iso.datetime(),
  code_expires_at: z.iso.datetime(),
  used_at: z.iso.datetime().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
});

export type EmailVerificationRequest = z.infer<typeof emailVerificationRequestsSchema>;

export const verifyManagerDataSchema = NewManagerDataSchema.pick({
  email: true,
}).extend({
  code: z
    .string()
    .min(6, 'Verification code must be at least 6 characters long')
    .max(6, 'Verification code must be exactly 6 characters long'),
});

export type VerifyManagerData = z.infer<typeof verifyManagerDataSchema>;

export const loginManagerDataSchema = NewManagerDataSchema.pick({
  email: true,
  password: true,
}).strict();

export type LoginManagerData = z.infer<typeof loginManagerDataSchema>;

export const ResendVerificationCodeDataSchema = ManagersRowSchema.pick({
  email: true,
}).strict();

export type ResendVerificationCodeData = z.infer<typeof ResendVerificationCodeDataSchema>;

export const ForgotPasswordDataSchema = ManagersRowSchema.pick({
  email: true,
}).strict();

export type ForgotPasswordData = z.infer<typeof ForgotPasswordDataSchema>;

export const PasswordUpdateDataSchema = z
  .object({
    request_id: z.uuid(),
    password: PasswordSchema,
    token: z.string().trim().min(10),
  })
  .strict();

export type PasswordUpdateData = z.infer<typeof PasswordUpdateDataSchema>;

export const ValidateTokenDataSchema = z
  .object({
    request_id: z.uuid(),
    token: z.string().trim().min(10),
  })
  .strict();

export type ValidateTokenData = z.infer<typeof ValidateTokenDataSchema>;

export type FetchManagerInfo = {
  id: string;
  full_name: string;
  email: string;
  role: string;
} | null;
