// Fetch Block Or Street Service
/*
#Plan:
1. Accept and validate managerId, and estateId
2. Ensure that manager is associated with estate 
3. Fetch all blockOrStreet data for estate
4. Send response to caller
*/

import { and, asc, eq, isNotNull, ne } from 'drizzle-orm';
import db from '../../../db/index.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { households } from '../../../db/schema/households.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const FetchBlockOrStreetService = async (managerId: string, estateId: string) => {
  const householdLogs = logger.child({
    service: 'FetchBlockOrStreetService',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate managerId, and estateId
    const safeManagerId = managerId?.trim();
    if (!safeManagerId) {
      householdLogs.warn('Manager data required', {
        managerId,
        estateId,
      });
      return errorResponseHelper(
        'Manager data required',
        'MANAGER_DATA_REQUIRED',
        'Manager data required',
      );
    }

    const safeEstateId = estateId?.trim();
    if (!safeEstateId) {
      householdLogs.warn('Estate data required', {
        managerId: safeManagerId,
        estateId,
      });
      return errorResponseHelper(
        'Estate data required',
        'ESTATE_DATA_REQUIRED',
        'Estate data required',
      );
    }

    // 2. Ensure that manager is associated with estate.
    const [estateManagerData] = await db
      .select({
        id: estateManagers.id,
      })
      .from(estateManagers)
      .where(
        and(eq(estateManagers.managerId, safeManagerId), eq(estateManagers.estateId, safeEstateId)),
      );

    if (!estateManagerData) {
      return errorResponseHelper(
        'Access denied for estate block/street data',
        'ESTATE_ACCESS_DENIED',
        'You do not have permission to access this estate',
      );
    }

    // 3. Fetch all blockOrStreet data for estate
    const blockOrStreetOptions = await db
      .selectDistinct({
        blockOrStreet: households.blockOrStreet,
      })
      .from(households)
      .where(
        and(
          eq(households.estateId, safeEstateId),
          isNotNull(households.blockOrStreet),
          ne(households.blockOrStreet, ''),
        ),
      )
      .orderBy(asc(households.blockOrStreet));

    // 4. Send response to caller
    const options = blockOrStreetOptions.map((item) => item.blockOrStreet);
    householdLogs.info('Block or street data fetched successfully', {
      managerId: safeManagerId,
      estateId: safeEstateId,
      count: options.length,
    });
    return successResponseHelper('Block or street data fetched successfully', {
      blockOrStreetOptions: options,
      count: options.length,
    });
  } catch (error) {
    const errMessage =
      error instanceof Error
        ? error.message
        : 'Unexpected error while fetching block or street data';

    householdLogs.error('Error fetching block or street data', {
      message: errMessage,
      error,
    });

    return errorResponseHelper(
      'Error fetching block or street data',
      'INTERNAL_SERVER_ERROR',
      'Error fetching block or street data',
    );
  }
};
