// Swap Principal Resident Service
/*
#Plan:
1. Accept and validate user id, old principal id, new principal id, household id, and estate id
2. Verify that the user id is estate manager of the estate id
3. Verify that the household id is associated with estate id
4. Verify that both the old and new principals belong to the specified household
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

export const swapPrincipalResidentService = async (
  userId: string,
  swapData: SwapPrincipalResidentType,
) => {
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

    // 4. Verify that both the old and new principals belong to the specified household
    const [isOldPrincipalBelong] = await db
      .select({ id: residents.id })
      .from(residents)
      .where(
        and(
          eq(residents.id, oldPrincipalId),
          eq(residents.householdId, householdId),
          eq(residents.role, 'principal'),
        ),
      );

    const [isNewPrincipalBelong] = await db
      .select({ id: residents.id, role: residents.role })
      .from(residents)
      .where(
        and(
          eq(residents.id, newPrincipalId),
          eq(residents.householdId, householdId),
          ne(residents.role, 'principal'),
        ),
      );

    let messageToSend: string[] = [];
    if (!isOldPrincipalBelong) {
      messageToSend.push('The current principal resident does not belong to the household');
    }

    if (!isNewPrincipalBelong) {
      messageToSend.push('The selected new principal resident does not belong to the household');
    }

    if (messageToSend.length > 0) {
      residentLogs.warn('One principal or another do not belong to household specified', {
        ...logContext,
      });
      return errorResponseHelper(
        `${messageToSend.join(' and ')}`,
        'ONE_OR_MORE_IDS_HOUSEHOLD_MISMATCH',
        `${messageToSend.join(' and ')}`,
      );
    }

    // 5. Swap the old principal with the new one
    const originalNewResidentRole = isNewPrincipalBelong.role ?? 'member';
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
      newPrincipalId: newPrincipalId,
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
