// Update Household And Principal Details Service
/*
#Plan:
1. Accept and validate the update data
2. Confirm that the authenticated user is an authorised manager
   of the specified estate.
3. Confirm that the specified household belongs to the estate.
4. Confirm that the specified person is a principal resident of the household.
5. Update the supplied household and/or resident fields within
   a single database transaction.
6. Retrieve and return the updated household and principal details.
*/

import { and, eq } from 'drizzle-orm';
import db from '../../../db/index.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import {
  UpdateHouseholdPrincipalRequestSchema,
  UpdateHouseholdPrincipalRequestType,
} from '../households.types.js';
import { households } from '../../../db/schema/households.js';
import { residents } from '../../../db/schema/residents.js';
import { persons } from '../../../db/schema/persons.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';
import { ZodError } from 'zod';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const updateHouseholdAndPrincipalDetailsService = async (
  userId: string,
  estateId: string,
  householdId: string,
  principalResidentId: string,
  updateData: UpdateHouseholdPrincipalRequestType,
) => {
  const householdLogs = logger.child({
    service: 'updateHouseholdAndPrincipalDetailsService',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the update data
    const trimmedUserId = userId.trim();
    const trimmedEstateId = estateId.trim();
    const trimmedHouseholdId = householdId.trim();
    const trimmedprincipalResidentId = principalResidentId.trim();

    if (!trimmedUserId) {
      householdLogs.warn('User id is required');
      return errorResponseHelper('User id is required', 'USER_ID_REQUIRED', 'User id is required');
    }

    if (!trimmedEstateId) {
      householdLogs.warn('Estate id is required', {
        estateId: trimmedEstateId,
      });
      return errorResponseHelper(
        'Estate id is required',
        'ESTATE_ID_REQUIRED',
        'Estate id is required',
      );
    }

    if (!trimmedHouseholdId) {
      householdLogs.warn('Household ID is required');

      return errorResponseHelper(
        'Household ID is required',
        'HOUSEHOLD_ID_REQUIRED',
        'Household ID is required',
      );
    }

    if (!trimmedprincipalResidentId) {
      householdLogs.warn('Principal resident ID is required');

      return errorResponseHelper(
        'Principal resident ID is required',
        'PRINCIPAL_RESIDENT_ID_REQUIRED',
        'Principal resident ID is required',
      );
    }

    const { household, principal } = UpdateHouseholdPrincipalRequestSchema.parse(updateData);

    // 2. Confirm that the authenticated user is an authorised manager
    //    of the specified estate.
    const [confirmedEstateManager] = await db
      .select({
        id: estateManagers.id,
      })
      .from(estateManagers)
      .where(
        and(
          eq(estateManagers.managerId, trimmedUserId),
          eq(estateManagers.estateId, trimmedEstateId),
        ),
      );

    if (!confirmedEstateManager) {
      householdLogs.warn('User is not an authorised estate manager', {
        userId: trimmedUserId,
        estateId: trimmedEstateId,
      });
      return errorResponseHelper('Unauthorized', 'USER_UNASSOCIATED_WITH_ESTATE', 'Unauthorized');
    }

    // 3. Confirm that the specified household belongs to the estate.
    const [confirmedEstateHousehold] = await db
      .select({
        id: households.id,
      })
      .from(households)
      .where(and(eq(households.id, trimmedHouseholdId), eq(households.estateId, trimmedEstateId)));

    if (!confirmedEstateHousehold) {
      householdLogs.warn('Household not associated with estate', {
        userId: trimmedUserId,
        estateId: trimmedEstateId,
      });
      return errorResponseHelper(
        'Household not associated with estate',
        'HOUSEHOLD_ESTATE_MISMATCH',
        'Household not associated with estate',
      );
    }

    // 4. Confirm that the specified resident is a principal resident of the household.
    const [householdPrincipal] = await db
      .select({ personId: persons.id })
      .from(residents)
      .innerJoin(persons, eq(persons.id, residents.personId))
      .where(
        and(
          eq(residents.id, trimmedprincipalResidentId),
          eq(residents.householdId, trimmedHouseholdId),
          eq(residents.role, 'principal'),
        ),
      );

    if (!householdPrincipal) {
      householdLogs.warn('Resident not principal of household', {
        userId: trimmedUserId,
        estateId: trimmedEstateId,
      });
      return errorResponseHelper(
        'Resident not principal of household',
        'PRINCIPAL_HOUSEHOLD_MISMATCH',
        'Resident not principal of household',
      );
    }

    // 5. Update the supplied household and/or resident fields within
    //    a single database transaction.
    const updatedRecord = await db.transaction(async (tx) => {
      if (household) {
        await tx
          .update(households)
          .set(household)
          .where(
            and(eq(households.id, trimmedHouseholdId), eq(households.estateId, trimmedEstateId)),
          );
      }

      if (principal) {
        const principalUpdateData = {
          ...principal,
          dateOfBirth: principal.dateOfBirth?.toString().slice(0, 10),
        };

        await tx
          .update(persons)
          .set(principalUpdateData)
          .where(eq(persons.id, householdPrincipal.personId));
      }

      const [updatedHousehold] = await tx
        .select()
        .from(households)
        .where(eq(households.id, trimmedHouseholdId))
        .limit(1);

      const [updatedPrincipal] = await tx
        .select()
        .from(persons)
        .where(eq(persons.id, householdPrincipal.personId))
        .limit(1);

      return {
        household: updatedHousehold,
        principal: updatedPrincipal,
      };
    });

    // 6. Retrieve and return the updated household and principal details.
    householdLogs.info('Household and principal records updated successfully', {
      userId: trimmedUserId,
      estateId: trimmedEstateId,
    });
    return successResponseHelper('Household and principal records updated successfully', {
      updatedRecord,
    });
  } catch (error: unknown) {
    const errMessage =
      error instanceof Error
        ? error.message
        : 'Error updating household and principal resident data';
    if (error instanceof ZodError) {
      householdLogs.error('Error updating household and principal data', {
        error: error.issues,
      });

      return errorResponseHelper(
        'Error updating household and principal resident data',
        'VALIDATION_ERROR',
        'Error updating household and principal resident data',
        error,
      );
    }

    householdLogs.error('Unexpected error while updating household and principal resident data', {
      message: errMessage,
      error,
    });

    return errorResponseHelper(
      'Unexpected error while updating household and principal resident data',
      'UNEXPECTED_ERROR',
      'Unexpected error while updating household and principal resident data',
      error,
    );
  }
};
