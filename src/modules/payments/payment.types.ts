import { z } from 'zod';

export type PaystackInitializePayload = {
  email: string;
  amount: number;
  reference: string;
  callback_url: string;
  metadata?: Record<string, unknown>;
};

export type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  } | null;
};

export const InitializeEstatePaymentInputSchema = z.object({
  user_id: z.string().trim().min(5),
  name: z.string().trim().min(2),
  location: z.string().trim().min(1),
  state: z.string().trim().min(1),
  logo_url: z.string().trim().min(5),
  plan_id: z.string().trim().min(5),
  period: z.enum(['monthly', 'yearly']),
});

export type InitializeEstatePaymentInput = z.infer<typeof InitializeEstatePaymentInputSchema>;
