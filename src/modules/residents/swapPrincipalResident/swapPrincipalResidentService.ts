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

import { and, eq, ne } from 'drizzle-orm';
import { ZodError } from 'zod';
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

  try {
    // 1. Accept and validate user id, old principal id, new principal id, household id, and estate id
    const trimmedUserId = userId.trim();
    if (!trimmedUserId) {
      residentLogs.warn('User id is required');
      return errorResponseHelper('User id is required', 'USER_ID_REQUIRED', 'User id is required');
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
      .where(
        and(eq(estateManagers.managerId, trimmedUserId), eq(estateManagers.estateId, estateId)),
      );

    if (!estateManager) {
      residentLogs.warn('User access request is unauthorized', {
        ...logContext,
      });
      return errorResponseHelper(
        'Unauthorized',
        'ACCESS_DENIED',
        'User access request is unauthorized',
      );
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
      return errorResponseHelper(
        'Household not associated with estate',
        'HOUSEHOLD_ESTATE_MISMATCH',
        'Household not associated with estate',
      );
    }

    // 4. Verify the current principal and selected replacement belong to the household
    const [currentPrincipal] = await db
      .select({ id: residents.id, })
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
        id: residents.id,
        fullName: persons.fullName,
        phone: persons.phone,
        photoUrl: persons.photoUrl, 
        email: persons.email,
        gender: persons.gender,
        dateOfBirth: persons.dateOfBirth,
        role: residents.role
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

      return errorResponseHelper(message, 'ONE_OR_MORE_IDS_HOUSEHOLD_MISMATCH', message);
    }

    // 5. Swap the old principal with the new one
    const originalNewResidentRole = selectedPrincipal.role;
    await db.transaction(async (tx) => {
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
    });

    // 6. Send the appropriate response to the caller/client
    residentLogs.info('The swap has been successfully done', {
      oldPrincipalId: oldPrincipalId,
      newPrincipalId: newPrincipalId,
      ...logContext,
    });
    return successResponseHelper('The swap has been successfully done', {
      oldPrincipalId: oldPrincipalId,
      newPrincipal: {
        ...selectedPrincipal,
        role: "principal",
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unexpected error while processing request';

    if (error instanceof ZodError) {
      residentLogs.error('Error validating update data', {
        ...logContext,
        message: errorMessage,
        error: error.issues,
      });
      return errorResponseHelper(
        'Error validating data input',
        'VALIDATION_ERROR',
        'Error validating data input',
      );
    }

    residentLogs.error('Unexpected error', {
      ...logContext,
      message: errorMessage,
      error,
    });
    return errorResponseHelper('Unexpected error', 'INTERNAL_SERVER_ERROR', 'Unexpected error');
  }
};
