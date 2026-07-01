import { z } from 'zod';

export const termiiPhoneSchema = z
  .string()
  .trim()
  .transform((v) => {
    let cleaned = v.replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = `234${cleaned.slice(1)}`;
    }
    return cleaned;
  });

const emailSchema = z
  .email()
  .trim()
  .transform((v) => v.toLowerCase());

const blockOrStreetSchema = z
  .string()
  .trim()
  .min(2)
  .transform((v) => v.toLowerCase());

export const CreateHouseholdInputSchema = z.object({
  estateId: z.uuid(),
  createdByManagerId: z.uuid(),
  households: z.array(
    z.object({
      house: z.object({
        unitNumber: z
          .string()
          .trim()
          .min(1)
          .max(50)
          .trim()
          .transform((v) => v.toLowerCase()),
        blockOrStreet: blockOrStreetSchema.optional(),
      }),
      principalResident: z.object({
        mode: z.enum(['create', 'link']),
        personId: z.string().optional(),
        fullName: z.string().optional(),
        email: emailSchema.optional(),
        phone: termiiPhoneSchema.optional(),
        gender: z.enum(['male', 'female', 'unknown']).default('unknown').optional(),
        photoUrl: z.url().optional(),
        dateOfBirth: z.string().optional(),
      }),
      members: z.array(
        z.object({
          mode: z.enum(['create', 'link']),
          personId: z.string().optional(),
          fullName: z.string().optional(),
          dateOfBirth: z.iso.date().optional(),
          email: emailSchema.optional(),
          phone: termiiPhoneSchema.optional(),
          photoUrl: z.string().optional(),
          gender: z.enum(['male', 'female', 'unknown']).default('unknown').optional(),
        }),
      ),
    }),
  ),
});

export type CreateHouseholdInputType = z.infer<typeof CreateHouseholdInputSchema>;

export type CreatedHouseholdSummary = {
  householdId: string;
  unitNumber: string;
  code: string;
  principalResident: {
    personId: string;
    code?: string;
  };
  members: {
    personId: string;
    code?: string;
  }[];
};

const CreateHouseholdControllerInputSchema = CreateHouseholdInputSchema.omit({
  createdByManagerId: true,
});

export type CreateHouseholdControllerInputType = z.infer<
  typeof CreateHouseholdControllerInputSchema
>;
