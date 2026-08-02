// Get All Non Principal Residents By Household Service
/*
#Plan:
1. Accept and validate user id, household id, and estate id
2. Verify that the user id is estate manager of the estate id
3. Verify that the household id is associated with estate id
4. Fetch all the non-principal residents of the household id
5. Send the appropriate response to the caller/client
*/

import { and, eq, ne } from 'drizzle-orm';
import db from '../../../db/index.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { households } from '../../../db/schema/households.js';
import { residents } from '../../../db/schema/residents.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';
import { ZodError } from 'zod';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const getAllNonPrincipalResidentsByHouseholdService = async (
  userId: string,
  householdId: string,
  estateId: string,
) => {
  const residentLogs = logger.child({
    service: 'getAllNonPrincipalResidentsByHouseholdService',
    requestId: randomUUID(),
  });

  let estateIdProcessing;
  let userIdProcessing;
  let householdIdProcessing;

  try {
    // 1. Accept and validate user id, household id, and estate id
    const trimmedUserId = userId.trim();
    const trimmedHouseholdId = householdId.trim();
    const trimmedEstateId = estateId.trim();

    if (!trimmedUserId) {
      residentLogs.warn('User id is required');
      return errorResponseHelper('User id is required', 'USER_ID_REQUIRED', 'User id is required');
    }

    userIdProcessing = trimmedUserId;
    if (!trimmedHouseholdId) {
      residentLogs.warn('Household id is required', {
        userId: trimmedUserId,
      });
      return errorResponseHelper(
        'Household id is required',
        'HOUSEHOLD_ID_REQUIRED',
        'Household id is required',
      );
    }

    householdIdProcessing = trimmedHouseholdId;
    if (!trimmedEstateId) {
      residentLogs.warn('Estate id is required', {
        userId: trimmedUserId,
        householdId: trimmedHouseholdId,
      });
      return errorResponseHelper(
        'Estate id is required',
        'ESTATE_ID_REQUIRED',
        'Estate id is required',
      );
    }

    estateIdProcessing = trimmedEstateId;
    // 2. Verify that the user id is estate manager of the estate id
    const [estateManager] = await db
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

    if (!estateManager) {
      residentLogs.warn('User access request is unauthorized', {
        userId: trimmedUserId,
        householdId: trimmedHouseholdId,
        estateId: trimmedEstateId,
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
      .where(and(eq(households.estateId, trimmedEstateId), eq(households.id, trimmedHouseholdId)));

    if (!estateHousehold) {
      residentLogs.warn('Household not associated with estate', {
        userId: trimmedUserId,
        householdId: trimmedHouseholdId,
        estateId: trimmedEstateId,
      });
      return errorResponseHelper(
        'Household not associated with estate',
        'HOUSEHOLD_ESTATE_MISMATCH',
        'Household not associated with estate',
      );
    }

    // 4. Fetch all the non-principal residents of the household id
    const nonPrincipalResidents = await db
      .select()
      .from(residents)
      .where(and(eq(residents.householdId, trimmedHouseholdId), ne(residents.role, 'principal')));

    // 5. Send the appropriate response to the caller/client
    residentLogs.info('Non-principal members of household fetched successfully', {
      count: nonPrincipalResidents.length,
    });
    return successResponseHelper('Non-principal members of household fetched successfully', {
      nonPrincipalResidents,
      count: nonPrincipalResidents.length,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unexpected error while processing request';

    if (error instanceof ZodError) {
      residentLogs.error('Error validating update data', {
        estateId: estateIdProcessing,
        userId: userIdProcessing,
        householdId: householdIdProcessing,
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
      estateId: estateIdProcessing,
      userId: userIdProcessing,
      householdId: householdIdProcessing,
      message: errorMessage,
      error,
    });
    return errorResponseHelper('Unexpected error', 'INTERNAL_SERVER_ERROR', 'Unexpected error');
  }
};
