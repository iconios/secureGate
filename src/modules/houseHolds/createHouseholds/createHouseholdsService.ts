// Create Households Service
/*
#Plan:
1. Accept and validate household, principal resident, optional members, and metadata
2. Validate the manager is authorized to create households for the estate
3. Validate household uniqueness within the estate
4. Validate duplicate household units inside the request
5. Validate duplicate people inside request
6. Validate person uniqueness within the estate, unless linking an existing person
7. Validate resident membership rules
    - Check that resident is not already a resident of another household within the estate
8. Create household, persons, and residents inside a transaction
9. Generate and store household/resident access code
10. Update the number of households in estate
11. Return created household summary
*/

import { ZodError } from 'zod';
import {
  CreatedHouseholdSummary,
  CreateHouseholdInputSchema,
  CreateHouseholdInputType,
} from '../households.types.js';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import db from '../../../db/index.js';
import { households } from '../../../db/schema/households.js';
import { and, eq, inArray, or, sql, SQL } from 'drizzle-orm';
import { persons } from '../../../db/schema/persons.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { residents } from '../../../db/schema/residents.js';
import { generateCode } from '../../../utils/codeGenHelper.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';
import { estates } from '../../../db/schema/estates.js';

export const CreateHouseholdsService = async (newHouseholdData: CreateHouseholdInputType) => {
  const householdLogs = logger.child({
    service: 'CreateHouseholdsService',
    requestId: randomUUID(),
  });

  let processingManagerId = '';
  let processingEstateId = '';
  try {
    // 1. Accept and validate household, principal resident, optional members, and metadata
    const validatedInput = CreateHouseholdInputSchema.parse(newHouseholdData);
    const { estateId, createdByManagerId, households: householdsData } = validatedInput;
    processingEstateId = estateId;
    processingManagerId = createdByManagerId;

    // 2. Validate the manager is authorized to create households for the estate
    const [estateManager] = await db
      .select({
        id: estateManagers.id,
      })
      .from(estateManagers)
      .where(
        and(
          eq(estateManagers.estateId, estateId),
          eq(estateManagers.managerId, createdByManagerId),
        ),
      )
      .limit(1);

    if (!estateManager) {
      householdLogs.warn('Manager not authorized to create households for estate', {
        estateId: estateId,
        managerId: createdByManagerId,
      });
      return errorResponseHelper(
        'Manager not authorized to create households for estate',
        'UNAUTHORIZED',
        'Manager not authorized to create households for estate',
      );
    }

    // 3. Validate household uniqueness within the estate
    if (householdsData.length === 0) {
      householdLogs.warn('No relevant households data found', {
        estateId: estateId,
        managerId: createdByManagerId,
      });
      return errorResponseHelper(
        'No relevant households data found',
        'HOUSEHOLDS_DATA_NOT_FOUND',
        'No relevant households data found',
      );
    }

    const householdConditions = householdsData.map((entry) =>
      and(
        eq(households.estateId, estateId),
        eq(households.unitNumber, entry.house.unitNumber.trim()),
        eq(households.blockOrStreet, entry.house.blockOrStreet?.trim() ?? ''),
      ),
    );

    const existingHouseholds = await db
      .select({
        blockOrStreet: households.blockOrStreet,
        unitNumber: households.unitNumber,
      })
      .from(households)
      .where(or(...householdConditions));

    if (existingHouseholds.length > 0) {
      const duplicateUnits = existingHouseholds.map(
        (item) => `${item.unitNumber} in ${item.blockOrStreet}`,
      );

      householdLogs.warn(
        'Some household unit numbers are already in use within the same block or street',
        {
          estateId: estateId,
          managerId: createdByManagerId,
        },
      );
      return errorResponseHelper(
        `${duplicateUnits.join(', ')} already in use`,
        'HOUSEHOLD_UNIT_ALREADY_IN_USE',
        'Some household unit numbers are already in use within the same block or street',
      );
    }

    // 4. Validate duplicate household units inside the request
    const householdUnitKeys = new Set<string>();
    const duplicateHouseholdUnits: string[] = [];

    for (const entry of householdsData) {
      const blockOrStreet = entry.house.blockOrStreet;
      const unitNumber = entry.house.unitNumber;

      const key = `${estateId}:${blockOrStreet}:${unitNumber}`;

      if (householdUnitKeys.has(key)) {
        duplicateHouseholdUnits.push(`${entry.house.unitNumber} in ${entry.house.blockOrStreet}`);
      }

      householdUnitKeys.add(key);
    }

    if (duplicateHouseholdUnits.length > 0) {
      return errorResponseHelper(
        `Duplicate household units in request: ${duplicateHouseholdUnits.join(', ')}`,
        'DUPLICATE_HOUSEHOLD_UNITS_IN_REQUEST',
        'Duplicate household unit numbers found within the same block or street',
      );
    }

    // 5. Validate duplicate people inside request
    const emailsInRequest = new Map<string, string[]>();
    const phonesInRequest = new Map<string, string[]>();
    const linkedPersonIdsInRequest = new Map<string, string[]>();

    const addToMap = (map: Map<string, string[]>, key: string, label: string) => {
      const existing = map.get(key) ?? [];
      existing.push(label);
      map.set(key, existing);
    };

    for (const [householdIndex, household] of householdsData.entries()) {
      const householdLabel = `household ${householdIndex + 1} (${household.house.unitNumber})`;

      const principal = household.principalResident;

      if (principal.mode === 'create') {
        const email = principal.email;
        const phone = principal.phone;

        if (email) {
          addToMap(emailsInRequest, email, `${householdLabel} principal resident`);
        }

        if (phone) {
          addToMap(phonesInRequest, phone, `${householdLabel} principal resident`);
        }
      }

      if (principal.mode === 'link' && principal.personId) {
        addToMap(
          linkedPersonIdsInRequest,
          principal.personId,
          `${householdLabel} principal resident`,
        );
      }

      for (const [memberIndex, member] of household.members.entries()) {
        const memberLabel = `${householdLabel} member ${memberIndex + 1}`;

        if (member.mode === 'create') {
          const email = member.email;
          const phone = member.phone;

          if (email) {
            addToMap(emailsInRequest, email, memberLabel);
          }

          if (phone) {
            addToMap(phonesInRequest, phone, memberLabel);
          }
        }

        if (member.mode === 'link' && member.personId) {
          addToMap(linkedPersonIdsInRequest, member.personId, memberLabel);
        }
      }
    }

    const duplicateEmails = [...emailsInRequest.entries()].filter(
      ([, locations]) => locations.length > 1,
    );

    const duplicatePhones = [...phonesInRequest.entries()].filter(
      ([, locations]) => locations.length > 1,
    );

    const duplicateLinkedPersons = [...linkedPersonIdsInRequest.entries()].filter(
      ([, locations]) => locations.length > 1,
    );

    const duplicateErrors: string[] = [];

    for (const [email, locations] of duplicateEmails) {
      duplicateErrors.push(`Email ${email} appears multiple times: ${locations.join(', ')}`);
    }

    for (const [phone, locations] of duplicatePhones) {
      duplicateErrors.push(`Phone ${phone} appears multiple times: ${locations.join(', ')}`);
    }

    for (const [personId, locations] of duplicateLinkedPersons) {
      duplicateErrors.push(
        `Linked person ${personId} appears multiple times: ${locations.join(', ')}`,
      );
    }

    if (duplicateErrors.length > 0) {
      return errorResponseHelper(
        duplicateErrors.join('; '),
        'DUPLICATE_PEOPLE_IN_REQUEST',
        'Duplicate people found inside request',
      );
    }

    // 6. Validate person uniqueness within the estate, unless linking an existing person
    const emailsToValidate = new Set<string>();
    const phonesToValidate = new Set<string>();
    const linkedPersonsIds = new Set<string>();

    // Collect all emails and phones from 'create'modes safely
    for (const household of householdsData) {
      if (household.principalResident.mode === 'create') {
        if (household.principalResident.email) {
          emailsToValidate.add(household.principalResident.email);
        }
        if (household.principalResident.phone) {
          phonesToValidate.add(household.principalResident.phone);
        }
      } else if (
        household.principalResident.mode === 'link' &&
        household.principalResident.personId
      ) {
        linkedPersonsIds.add(household.principalResident.personId);
      }

      // Check array members
      for (const member of household.members) {
        if (member.mode === 'create') {
          if (member.email) {
            emailsToValidate.add(member.email);
          }
          if (member.phone) {
            phonesToValidate.add(member.phone);
          }
        } else if (member.mode === 'link' && member.personId) {
          linkedPersonsIds.add(member.personId);
        }
      }
    }

    // Check for unique identity conflicts
    const personConditions: SQL[] = [];
    if (emailsToValidate.size > 0) {
      personConditions.push(inArray(persons.email, Array.from(emailsToValidate)));
    }

    if (phonesToValidate.size > 0) {
      personConditions.push(inArray(persons.phone, Array.from(phonesToValidate)));
    }

    if (personConditions.length > 0) {
      const existingRecords = await db
        .select({
          email: persons.email,
          phone: persons.phone,
        })
        .from(persons)
        .where(and(eq(persons.estateId, estateId), or(...personConditions)));

      if (existingRecords.length > 0) {
        const errors: string[] = [];

        for (const record of existingRecords) {
          if (record.email && emailsToValidate.has(record.email)) {
            errors.push(`The email ${record.email} is already registered`);
          }
          if (record.phone && phonesToValidate.has(record.phone)) {
            errors.push(`The phone ${record.phone} is already registered`);
          }
        }
        householdLogs.warn('Some emails or phones in the household data are already in use', {
          estateId: estateId,
          managerId: createdByManagerId,
        });
        return errorResponseHelper(
          errors.join('; '),
          'EMAIL_OR_PHONE_ALREADY_IN_USE',
          'Some emails or phones in the household data are already in use',
        );
      }
    }

    // Check existence of linked records
    if (linkedPersonsIds.size > 0) {
      const principalResidents = await db
        .select({
          id: persons.id,
        })
        .from(persons)
        .where(
          and(eq(persons.estateId, estateId), inArray(persons.id, Array.from(linkedPersonsIds))),
        );

      if (principalResidents.length < linkedPersonsIds.size) {
        householdLogs.warn('Some linked residents are not found', {
          estateId: estateId,
          managerId: createdByManagerId,
        });
        return errorResponseHelper(
          'Some linked residents are not found',
          'PERSONS_NOT_FOUND',
          'Some linked residents are not found',
        );
      }
    }

    // 7. Validate resident membership rules
    // - Check that resident is not already a resident of another household within the estate
    if (linkedPersonsIds.size > 0) {
      const alreadyResidents = await db
        .select({
          householdId: households.id,
        })
        .from(residents)
        .innerJoin(
          households,
          and(eq(residents.householdId, households.id), eq(households.estateId, estateId)),
        )
        .where(inArray(residents.personId, Array.from(linkedPersonsIds)));

      if (alreadyResidents.length > 0) {
        householdLogs.warn('Linked persons cannot belong to two households', {
          estateId: estateId,
          managerId: createdByManagerId,
        });
        return errorResponseHelper(
          'Linked persons cannot belong to two households',
          'CANNOT_BE_IN_MULTIPLE_HOUSEHOLDS',
          'Linked persons cannot belong to two households',
        );
      }
    }

    // 8. Create household, persons, and residents inside a transaction
    const processingSummary = await db.transaction(async (tx) => {
      const summaries: CreatedHouseholdSummary[] = [];

      for (const entry of householdsData) {
        // --- A. Create Household ---
        const householdCode = `H-${generateCode()}`;
        const [insertedHousehold] = await tx
          .insert(households)
          .values({
            estateId,
            blockOrStreet: entry.house.blockOrStreet,
            unitNumber: entry.house.unitNumber,
            code: householdCode,
          })
          .returning({
            id: households.id,
            unitNumber: households.unitNumber,
            blockOrStreet: households.blockOrStreet,
          });

        // --- B. Resolve Principal Resident Person ID ---
        let principalPersonId: string;

        if (entry.principalResident.mode === 'create') {
          const [newPerson] = await tx
            .insert(persons)
            .values({
              estateId,
              fullName: entry.principalResident.fullName ?? '',
              gender: entry.principalResident.gender ?? 'unknown',
              email: entry.principalResident.email ?? '',
              phone: entry.principalResident.phone ?? '',
              photoUrl: entry.principalResident.photoUrl,
              dateOfBirth: entry.principalResident.dateOfBirth,
            })
            .returning({ id: persons.id });

          principalPersonId = newPerson.id;
        } else {
          principalPersonId = entry.principalResident.personId!;
        }

        // --- C. Link Principal Resident Role to Household ---
        // 9. Generate and store household/resident access code
        const principalResidentCode = `R-${generateCode()}`;
        await tx.insert(residents).values({
          addedByManager: createdByManagerId,
          code: principalResidentCode,
          householdId: insertedHousehold.id,
          personId: principalPersonId,
          estateId: estateId,
          role: 'principal',
        });

        // --- D. Resolve and Link Secondary Optional Members ---
        const secondaryMembersSummary: CreatedHouseholdSummary['members'] = [];

        for (const member of entry.members) {
          let memberPersonId: string;

          if (member.mode === 'create') {
            const [newMemberPerson] = await tx
              .insert(persons)
              .values({
                estateId,
                fullName: member.fullName ?? '',
                gender: member.gender ?? 'unknown',
                email: member.email ?? '',
                phone: member.phone ?? '',
                photoUrl: member.photoUrl,
                dateOfBirth: member.dateOfBirth,
              })
              .returning({ id: persons.id });

            memberPersonId = newMemberPerson.id;
          } else {
            memberPersonId = member.personId!;
          }

          const residentCode = `R-${generateCode()}`;
          await tx.insert(residents).values({
            householdId: insertedHousehold.id,
            personId: memberPersonId,
            role: 'member',
            addedByManager: createdByManagerId,
            estateId: estateId,
            code: residentCode,
          });

          secondaryMembersSummary.push({
            personId: memberPersonId,
            code: residentCode,
          });
        }

        // 
        const [principalResident] = await tx
          .select({
            fullName: persons.fullName,
            photoUrl: persons.photoUrl,
          })
          .from(persons)
          .where(
            eq(persons.id, principalPersonId)
          )

        // Add to return bundle
        summaries.push({
          householdId: insertedHousehold.id,
          unitNumber: insertedHousehold.unitNumber,
          blockOrStreet: insertedHousehold.blockOrStreet ?? "",
          code: householdCode,
          principalResident: {
            personId: principalPersonId,
            code: principalResidentCode,
            fullName: principalResident.fullName,
            photoUrl: principalResident.photoUrl ?? "",
          },
          members: secondaryMembersSummary,
        });
      };

      // 10. Update the number of households in estate
      await tx
        .update(estates)
        .set({
          numberOfHouseholds: sql<number>`
            COALESCE(${estates.numberOfHouseholds}, 0)
            + ${householdsData.length}
          `,
        })
        .where(eq(estates.id, estateId));

      return summaries;
    });

    // 11. Return created household summary
    householdLogs.info('Households and residents successfully provisioned', {
      estateId,
      managerId: createdByManagerId,
      count: processingSummary.length,
      households: processingSummary.map((item) => item.householdId),
    });
    return successResponseHelper('Households and residents successfully provisioned', {
      households: processingSummary,
      count: processingSummary.length,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unexpected error while creating households';

    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      householdLogs.warn('Duplicate constraint violation while creating household', {
        estateId: processingEstateId,
        managerId: processingManagerId,
        error,
      });

      return errorResponseHelper(
        'Duplicate household, person, or resident record found',
        'DUPLICATE_RECORD',
        'A duplicate record already exists',
      );
    }

    if (error instanceof ZodError) {
      householdLogs.error('Household data validation failed', {
        error: error,
      });
      return errorResponseHelper(
        'Household data validation failed',
        'HOUSEHOLD_VALIDATION_ERROR',
        'Household data validation failed',
        error.issues,
      );
    }

    householdLogs.error('Unexpected error while creating households', {
      message: errorMessage,
      error,
    });
    return errorResponseHelper(
      'Unexpected error while creating households',
      'INTERNAL_SERVER_ERROR',
      'Unexpected error while creating households',
    );
  }
};
