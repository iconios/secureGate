// Get All Non Principal Residents By Household Service
/*
#Plan:
1. Accept and validate user id, household id, and estate id
2. Verify that the user id is estate manager of the estate id
3. Verify that the household id is associated with estate id
4. Fetch all the non-principal residents (with notNull email) of the household id
5. Send the appropriate response to the caller/client
*/

import { and, asc, eq, ilike, isNotNull, ne, or } from 'drizzle-orm';
import db from '../../../db/index.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { households } from '../../../db/schema/households.js';
import { residents } from '../../../db/schema/residents.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';
import { ZodError } from 'zod';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { persons } from '../../../db/schema/persons.js';
import {
  GetNonPrincipalsByHouseholdSchema,
  GetNonPrincipalsByHouseholdType,
} from '../residents.types.js';

type LogContext = {
  userId?: string;
  householdId?: string;
  estateId?: string;
};

export const getAllNonPrincipalResidentsByHouseholdService = async (
  inputData: GetNonPrincipalsByHouseholdType,
) => {
  const residentLogs = logger.child({
    service: 'getAllNonPrincipalResidentsByHouseholdService',
    requestId: randomUUID(),
  });

  let logContext: LogContext = {};

  try {
    // 1. Accept and validate user id, household id, and estate id
    const { userId, estateId, householdId, searchTerm } =
      GetNonPrincipalsByHouseholdSchema.parse(inputData);
    logContext = {
      userId,
      estateId,
      householdId,
    };

    // 2. Verify that the user id is estate manager of the estate id
    const [estateManager] = await db
      .select({
        id: estateManagers.id,
      })
      .from(estateManagers)
      .where(and(eq(estateManagers.managerId, userId), eq(estateManagers.estateId, estateId)))
      .limit(1);

    if (!estateManager) {
      residentLogs.warn('User access request is unauthorized', {
        userId: userId,
        householdId: householdId,
        estateId: estateId,
      });
      return errorResponseHelper(
        'Unauthorized',
        'ACCESS_DENIED',
        'User access request is unauthorized',
      );
    }

    // 3. Verify that the household id is associated with estate id
    const [estateHousehold] = await db
      .select({
        id: households.id,
      })
      .from(households)
      .where(and(eq(households.estateId, estateId), eq(households.id, householdId)))
      .limit(1);

    if (!estateHousehold) {
      residentLogs.warn('Household not associated with estate', {
        userId: userId,
        householdId: householdId,
        estateId: estateId,
      });
      return errorResponseHelper(
        'Household not associated with estate',
        'HOUSEHOLD_ESTATE_MISMATCH',
        'Household not associated with estate',
      );
    }

    // 4. Fetch all the non-principal residents of the household id
    const normalizedSearchTerm = searchTerm?.trim() ?? '';
    const searchPattern = `%${normalizedSearchTerm}%`;

    const residentSearchWhere = normalizedSearchTerm
      ? and(
          eq(residents.householdId, householdId),
          eq(residents.estateId, estateId),
          ne(residents.role, 'principal'),
          isNotNull(persons.email),
          or(
            ilike(persons.fullName, searchPattern),
            ilike(persons.email, searchPattern),
            ilike(persons.phone, searchPattern),
          ),
        )
      : and(
          eq(residents.householdId, householdId),
          eq(residents.estateId, estateId),
          ne(residents.role, 'principal'),
          isNotNull(persons.email),
        );

    const nonPrincipalResidents = await db
      .select({
        id: residents.id,
        personId: persons.id,
        fullName: persons.fullName,
        email: persons.email ?? '',
        phone: persons.phone ?? '',
        photoUrl: persons.photoUrl ?? '',
      })
      .from(residents)
      .innerJoin(persons, eq(persons.id, residents.personId))
      .where(residentSearchWhere)
      .orderBy(asc(persons.fullName), asc(residents.id));

    // 5. Send the appropriate response to the caller/client
    residentLogs.info('Non-principal residents of household fetched successfully', {
      count: nonPrincipalResidents.length,
    });
    return successResponseHelper('Non-principal residents of household fetched successfully', {
      nonPrincipalResidents,
      count: nonPrincipalResidents.length,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unexpected error while processing request';

    if (error instanceof ZodError) {
      residentLogs.error('Error validating request data', {
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
