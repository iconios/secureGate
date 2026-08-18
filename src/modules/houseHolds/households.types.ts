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

const blockOrStreetSchema = z.string().trim().min(2);

export const CreateHouseholdInputSchema = z.object({
  estateId: z.uuid(),
  createdByManagerId: z.uuid(),
  households: z.array(
    z.object({
      house: z.object({
        unitNumber: z.string().trim().min(1).max(50).trim(),
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
  blockOrStreet: string;
  code: string;
  principalResident: {
    personId: string;
    code?: string;
    fullName: string;
    photoUrl: string;
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

export const FetchHouseholdsByEstateSchema = z
  .object({
    userId: z.string().min(1),
    estateId: z.string().min(1),
    page: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(10),
    searchTerm: z.string().trim().optional().default(''),
  })
  .strict();

export type FetchHouseholdsByEstateType = z.input<typeof FetchHouseholdsByEstateSchema>;

export const FetchHouseholdsByEstateControllerBody = FetchHouseholdsByEstateSchema.omit({
  userId: true,
});

const idSchema = z.string().trim().min(1, 'ID is required');

export const UpdateHouseholdDataSchema = z
  .object({
    unitNumber: z.string().trim().min(1).max(50).optional(),
    blockOrStreet: blockOrStreetSchema.optional(),
    mobileAccess: z.boolean().optional(),
    guestPreAuthorize: z.boolean().optional(),
        guestArrivalNotify: z.boolean().optional(),
        emergencyAlerts: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one household field to update',
  });

export type UpdateHouseholdDataType = z.infer<typeof UpdateHouseholdDataSchema>;

export const UpdateHouseholdPrincipalDataSchema = z
  .object({
    fullName: z.string().trim().min(1).max(150).optional(),
    email: emailSchema.optional(),
    phone: termiiPhoneSchema.optional(),
    gender: z.enum(['male', 'female']).optional(),
    photoUrl: z.url().optional(),
    dateOfBirth: z.iso.datetime().optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one principal field to update',
  });

export type UpdateHouseholdPrincipalDataType = z.infer<typeof UpdateHouseholdPrincipalDataSchema>;

export const UpdateHouseholdPrincipalRequestSchema = z
  .object({
    household: UpdateHouseholdDataSchema.optional(),
    principal: UpdateHouseholdPrincipalDataSchema.optional(),
  })
  .strict()
  .refine((data) => data.household !== undefined || data.principal !== undefined, {
    message: 'Provide household or principal update data',
  });

export type UpdateHouseholdPrincipalRequestType = z.infer<
  typeof UpdateHouseholdPrincipalRequestSchema
>;

export const DeleteHouseholdDataSchema = z
  .object({
    householdId: z
      .string()
      .trim()
      .min(5, { message: 'Household id requires minimum of 5 characters' }),
    estateId: z.string().trim().min(5, { message: 'Estate id requires minimum of 5 characters' }),
  })
  .strict();

export type DeleteHouseholdDataType = z.infer<typeof DeleteHouseholdDataSchema>;
