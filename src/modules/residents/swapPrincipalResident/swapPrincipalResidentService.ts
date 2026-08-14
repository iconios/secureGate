// Swap Principal Resident Service
/*
#Plan:
1. Accept and validate user id, old principal id, new principal id, household id, and estate id
2. Verify that the user id is estate manager of the estate id
3. Verify that the household id is associated with estate id
4. Verify the current principal and selected replacement belong to the household
5. Swap the old principal with the new one
6. Send the appropriate response to the caller/client
*/

import { and, count, eq, ne } from 'drizzle-orm';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { SwapPrincipalResidentSchema, SwapPrincipalResidentType } from '../residents.types.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import db from '../../../db/index.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { households } from '../../../db/schema/households.js';
import { residents } from '../../../db/schema/residents.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';
import { persons } from '../../../db/schema/persons.js';
import { AppError } from '../../../common/errors/appError.js';

export const swapPrincipalResidentService = async (
  userId: string,
  swapData: SwapPrincipalResidentType,
): Promise<ReturnType<typeof successResponseHelper> | ReturnType<typeof errorResponseHelper>> => {
  const residentLogs = logger.child({
    service: 'swapPrincipalResidentService',
    requestId: randomUUID(),
  });

  // Track context for the catch-block log
  let logContext: { userId?: string; estateId?: string; householdId?: string } = {};

  // 1. Accept and validate user id, old principal id, new principal id, household id, and estate id
  const trimmedUserId = userId.trim();
  if (!trimmedUserId) {
    residentLogs.warn('User id is required');
    throw new AppError(400, 'USER_ID_REQUIRED', 'User id is required', 'User id is required');
  }

  const { oldPrincipalId, newPrincipalId, estateId, householdId } =
    SwapPrincipalResidentSchema.parse(swapData);

  logContext = { userId: trimmedUserId, estateId, householdId };

  // 2. Verify that the user id is estate manager of the estate id
  const [estateManager] = await db
    .select({
      id: estateManagers.id,
    })
    .from(estateManagers)
    .where(and(eq(estateManagers.managerId, trimmedUserId), eq(estateManagers.estateId, estateId)));

  if (!estateManager) {
    residentLogs.warn('User access request is unauthorized', {
      ...logContext,
    });
    throw new AppError(403, 'ACCESS_DENIED', 'User access request is unauthorized', 'Unauthorized');
  }

  // 3. Verify that the household id is associated with estate id
  const [estateHousehold] = await db
    .select()
    .from(households)
    .where(and(eq(households.estateId, estateId), eq(households.id, householdId)));

  if (!estateHousehold) {
    residentLogs.warn('Household not associated with estate', {
      ...logContext,
    });
    throw new AppError(
      409,
      'HOUSEHOLD_ESTATE_MISMATCH',
      'Household not associated with estate',
      'Household not associated with estate',
    );
  }

  // 4. Verify the current principal and selected replacement belong to the household
  const [currentPrincipal] = await db
    .select({ id: residents.id })
    .from(residents)
    .where(
      and(
        eq(residents.id, oldPrincipalId),
        eq(residents.householdId, householdId),
        eq(residents.role, 'principal'),
      ),
    );

  const [selectedPrincipal] = await db
    .select({
      id: persons.id,
      fullName: persons.fullName,
      phone: persons.phone,
      photoUrl: persons.photoUrl,
      email: persons.email,
      gender: persons.gender,
      dateOfBirth: persons.dateOfBirth,
      role: residents.role,
      estateId: persons.estateId,
    })
    .from(residents)
    .innerJoin(persons, eq(persons.id, residents.personId))
    .where(
      and(
        eq(residents.id, newPrincipalId),
        eq(residents.householdId, householdId),
        ne(residents.role, 'principal'),
      ),
    )
    .limit(1);

  if (!currentPrincipal || !selectedPrincipal) {
    const messages: string[] = [];

    if (!currentPrincipal) {
      messages.push(
        'The current principal resident does not belong to the household or is not the principal',
      );
    }

    if (!selectedPrincipal) {
      messages.push(
        'The selected resident does not belong to the household or is already the principal',
      );
    }

    const message = messages.join(' and ');

    residentLogs.warn('One or more residents failed swap validation', {
      ...logContext,
      oldPrincipalId,
      newPrincipalId,
    });

    throw new AppError(409, 'ONE_OR_MORE_IDS_HOUSEHOLD_MISMATCH', message, message);
  }

  // 5. Swap the old principal with the new one
  const originalNewResidentRole = selectedPrincipal.role;
  const swappedHousehold = await db.transaction(async (tx) => {
    await tx
      .update(residents)
      .set({
        role: originalNewResidentRole,
      })
      .where(and(eq(residents.id, oldPrincipalId), eq(residents.householdId, householdId)));

    await tx
      .update(residents)
      .set({
        role: 'principal',
      })
      .where(and(eq(residents.id, newPrincipalId), eq(residents.householdId, householdId)));

    const [updatedHousehold] = await tx
      .select({
        id: households.id,
        code: households.code,
        estateId: households.estateId,
        blockOrStreet: households.blockOrStreet,
        unitNumber: households.unitNumber,
      })
      .from(households)
      .where(and(eq(households.id, householdId), eq(households.estateId, estateId)))
      .limit(1);

    const [residentsCount] = await tx
      .select({
        count: count(),
      })
      .from(residents)
      .where(and(eq(residents.householdId, householdId), eq(residents.estateId, estateId)));

    return {
      household: updatedHousehold,
      residentsCount: residentsCount.count,
    };
  });

  // 6. Send the appropriate response to the caller/client
  residentLogs.info('The swap has been successfully done', {
    oldPrincipalId: oldPrincipalId,
    newPrincipalId: newPrincipalId,
    ...logContext,
  });
  return successResponseHelper('The swap has been successfully done', {
    household: swappedHousehold.household,
    principal: {
      ...selectedPrincipal,
      role: 'principal',
    },
    totalResidents: swappedHousehold.residentsCount,
  });
};
