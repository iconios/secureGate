// Get All Non Principal Residents By Estate
/*
#Plan:
1. Accept and validate user id and estate id
2. Verify that the user id is associated with the estate id
3. Fetch all the non-principal residents of the estate id
4. Send the appropriate response to the caller/client
*/

import { and, eq, ilike, ne, or } from 'drizzle-orm';
import db from '../../../db/index.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import {
  GetAllNonPrincipalResidentsByEstateInput,
  GetAllNonPrincipalResidentsByEstateSchema,
} from '../../residents/residents.types.js';
import { residents } from '../../../db/schema/residents.js';
import { persons } from '../../../db/schema/persons.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';
import { ZodError } from 'zod';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const getAllNonPrincipalResidentsByEstateService = async (
  userEstateInput: GetAllNonPrincipalResidentsByEstateInput,
) => {
  const residentLogs = logger.child({
    service: 'GetAllNonPrincipalResidentsByEstateService',
    requestId: randomUUID(),
  });

  let userIdProcessing = '';
  let estateIdProcessing = '';
  try {
    // 1. Accept and validate user id and estate id
    const { userId, estateId, searchTerm } =
      GetAllNonPrincipalResidentsByEstateSchema.parse(userEstateInput);
    userIdProcessing = userId;
    estateIdProcessing = estateId;

    // 2. Verify that the user id is associated with the estate id
    const [userLinkedData] = await db
      .select()
      .from(estateManagers)
      .where(and(eq(estateManagers.managerId, userId), eq(estateManagers.estateId, estateId)));

    if (!userLinkedData) {
      residentLogs.warn('User not associated with estate', {
        estateId,
        userId,
      });
      return errorResponseHelper(
        'User not associated with estate',
        'ACCESS_DENIED',
        'User not associated with estate',
      );
    }

    // 3. Fetch all the non-principal residents of the estate id
    const search = `%${searchTerm}%`;
    const residentsWhere = searchTerm
      ? and(
          eq(residents.estateId, estateId),
          ne(residents.role, 'principal'),
          or(ilike(persons.fullName, search), ilike(persons.phone, search)),
        )
      : and(eq(residents.estateId, estateId), ne(residents.role, 'principal'));

    const nonPrincipals = await db
      .select({
        id: residents.id,
        fullName: persons.fullName,
        phone: persons.phone,
      })
      .from(residents)
      .innerJoin(persons, eq(residents.personId, persons.id))
      .where(residentsWhere);

    // 4. Send the appropriate response to the caller/client
    residentLogs.info('Non-principal residents successfully fetched', {
      estateId,
      userId,
      count: nonPrincipals?.length,
    });
    return successResponseHelper('Non-principal residents successfully fetched', {
      count: nonPrincipals?.length,
      nonPrincipals: nonPrincipals,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unexpected error while processing request';

    if (error instanceof ZodError) {
      residentLogs.error('Error validating data input', {
        estateId: estateIdProcessing,
        userId: userIdProcessing,
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
      message: errorMessage,
      error,
    });
    return errorResponseHelper('Unexpected error', 'INTERNAL_SERVER_ERROR', 'Unexpected error');
  }
};
