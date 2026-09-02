// Update Household And Principal Details Service
/*
#Plan:
1. Accept and validate the update data
2. Confirm that the authenticated user is an authorised manager
   of the specified estate.
3. Confirm that the specified household belongs to the estate.
4. Confirm that the specified person is a principal resident of the household.
5. Confirm that the resulting unit number and street combination is unique within the estate.
6. Update the supplied household and/or resident fields within
   a single database transaction.
7. Retrieve and return the updated household and principal details.
*/

import { and, count, eq, isNull, ne } from 'drizzle-orm';
import db from '../../../db/index.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import {
  UpdateHouseholdPrincipalRequestSchema,
  UpdateHouseholdPrincipalRequestType,
} from '../households.types.js';
import { households } from '../../../db/schema/households.js';
import { residents } from '../../../db/schema/residents.js';
import { persons } from '../../../db/schema/persons.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { AppError } from '../../../common/errors/appError.js';

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

  // 1. Accept and validate the update data
  const trimmedUserId = userId.trim();
  const trimmedEstateId = estateId.trim();
  const trimmedHouseholdId = householdId.trim();
  const trimmedprincipalResidentId = principalResidentId.trim();

  if (!trimmedUserId) {
    householdLogs.warn('User id is required');

    throw new AppError(400, 'USER_ID_REQUIRED', 'Missing user id', 'User id is required');
  }

  if (!trimmedEstateId) {
    householdLogs.warn('Estate id is required', {
      estateId: trimmedEstateId,
    });

    throw new AppError(400, 'ESTATE_ID_REQUIRED', 'Missing estate id', 'Estate id is required');
  }

  if (!trimmedHouseholdId) {
    householdLogs.warn('Household ID is required');

    throw new AppError(
      400,
      'HOUSEHOLD_ID_REQUIRED',
      'Missing household id',
      'Household ID is required',
    );
  }

  if (!trimmedprincipalResidentId) {
    householdLogs.warn('Principal resident ID is required');

    throw new AppError(
      400,
      'PRINCIPAL_RESIDENT_ID_REQUIRED',
      'Missing principal resident id',
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

    throw new AppError(
      401,
      'USER_UNASSOCIATED_WITH_ESTATE',
      'Unauthorized request',
      'Unauthorized',
    );
  }

  // 3. Confirm that the specified household belongs to the estate.
  const [confirmedEstateHousehold] = await db
    .select({
      id: households.id,
      unitNumber: households.unitNumber,
      blockOrStreet: households.blockOrStreet,
    })
    .from(households)
    .where(and(eq(households.id, trimmedHouseholdId), eq(households.estateId, trimmedEstateId)))
    .limit(1);

  if (!confirmedEstateHousehold) {
    householdLogs.warn('Household not associated with estate', {
      userId: trimmedUserId,
      estateId: trimmedEstateId,
    });

    throw new AppError(
      409,
      'HOUSEHOLD_ESTATE_MISMATCH',
      'Household not associated with estate',
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
    householdLogs.warn('Resident not principal in household', {
      userId: trimmedUserId,
      estateId: trimmedEstateId,
    });

    throw new AppError(
      409,
      'PRINCIPAL_HOUSEHOLD_MISMATCH',
      'Resident not principal in household',
      'Resident not principal in household',
    );
  }

  // 5. Confirm that the resulting unit number and street combination
  //    is unique within the estate.
  const isAddressBeingUpdated =
    household?.unitNumber !== undefined || household?.blockOrStreet !== undefined;

  if (isAddressBeingUpdated) {
    const candidateUnitNumber = household?.unitNumber ?? confirmedEstateHousehold.unitNumber;

    const candidateBlockOrStreet =
      household?.blockOrStreet ?? confirmedEstateHousehold.blockOrStreet;

    const unitNumberCondition =
      candidateUnitNumber === null
        ? isNull(households.unitNumber)
        : eq(households.unitNumber, candidateUnitNumber);

    const blockOrStreetCondition =
      candidateBlockOrStreet === null
        ? isNull(households.blockOrStreet)
        : eq(households.blockOrStreet, candidateBlockOrStreet);

    const [duplicateHousehold] = await db
      .select({
        id: households.id,
      })
      .from(households)
      .where(
        and(
          eq(households.estateId, trimmedEstateId),
          unitNumberCondition,
          blockOrStreetCondition,
          ne(households.id, trimmedHouseholdId),
        ),
      )
      .limit(1);

    if (duplicateHousehold) {
      householdLogs.warn('Household with the same unit number and street already exists', {
        estateId: trimmedEstateId,
        householdId: trimmedHouseholdId,
        duplicateHouseholdId: duplicateHousehold.id,
      });

      throw new AppError(
        409,
        'HOUSEHOLD_DUPLICATE',
        'Household with the same unit number and street already exists',
        'Household with the same unit number and street already exists',
      );
    }
  }

  // 6. Update the supplied household and/or resident fields within
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
      .select({
        id: households.id,
        code: households.code,
        estateId: households.estateId,
        blockOrStreet: households.blockOrStreet,
        unitNumber: households.unitNumber,
        mobileAccess: households.mobileAccess,
        guestPreAuthorize: households.guestPreAuthorize,
        guestArrivalNotify: households.guestArrivalNotify,
        emergencyAlerts: households.emergencyAlerts,
      })
      .from(households)
      .where(eq(households.id, trimmedHouseholdId))
      .limit(1);

    const [updatedPrincipal] = await tx
      .select({
        id: persons.id,
        fullName: persons.fullName,
        phone: persons.phone,
        photoUrl: persons.photoUrl,
        email: persons.email,
        gender: persons.gender,
        dateOfBirth: persons.dateOfBirth,
        estateId: persons.estateId,
      })
      .from(persons)
      .where(eq(persons.id, householdPrincipal.personId))
      .limit(1);

    const [householdResidentCount] = await tx
      .select({
        count: count(),
      })
      .from(residents)
      .where(
        and(eq(residents.householdId, trimmedHouseholdId), eq(residents.estateId, trimmedEstateId)),
      );

    return {
      household: updatedHousehold,
      principal: updatedPrincipal,
      totalResidents: householdResidentCount.count,
    };
  });

  // 7. Retrieve and return the updated household and principal details.
  householdLogs.info('Household and principal records updated successfully', {
    userId: trimmedUserId,
    estateId: trimmedEstateId,
  });
  return successResponseHelper('Household and principal records updated successfully', {
    ...updatedRecord,
  });
};
