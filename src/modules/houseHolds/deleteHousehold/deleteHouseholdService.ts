// Delete Household Service
/*
#Plan:
1. Accept and validate the household id, estate id, and user id
2. Validate user id is authorized to manage estate
3. Verify household exists within the estate
4. In a transaction:
    Delete all residents associated with household
    Delete all vehicles associated with household
    Delete household
5. Send response to user or caller
*/

import { ZodError } from 'zod';
import { DeleteHouseholdDataSchema, DeleteHouseholdDataType } from '../households.types.js';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import db from '../../../db/index.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { and, eq } from 'drizzle-orm';
import { residents } from '../../../db/schema/residents.js';
import { households } from '../../../db/schema/households.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';

type LogContext = {
  householdId: string;
  estateId: string;
};

class HouseholdNotFoundError extends Error {
  constructor() {
    super('Household not found');
    this.name = 'HouseholdNotFoundError';
  }
}

export const deleteHouseholdService = async (
  deleteData: DeleteHouseholdDataType,
  userId: string,
) => {
  const householdLogs = logger.child({
    service: 'deleteHouseholdService',
    requestId: randomUUID(),
    userId,
  });

  let logContext: LogContext | null = null;
  try {
    // 1. Accept and validate the household id, estate id, and user id
    const { householdId, estateId } = DeleteHouseholdDataSchema.parse(deleteData);
    logContext = {
      householdId,
      estateId,
    };

    // 2. Validate user id is authorized to manage estate
    const [estateManager] = await db
      .select({
        id: estateManagers.id,
      })
      .from(estateManagers)
      .where(and(eq(estateManagers.managerId, userId), eq(estateManagers.estateId, estateId)))
      .limit(1);

    if (!estateManager) {
      householdLogs.warn('Household deletion access denied', {
        ...logContext,
      });
      return errorResponseHelper(
        'You do not have permission to perform this action',
        'ACCESS_DENIED',
        'Household deletion access denied',
      );
    }

    //4. In a transaction:
    // Delete all residents associated with household
    // Delete all vehicles associated with household
    // Delete household
    const deletedRecord = await db.transaction(async (tx) => {
      // Verify household exists within the estate
      const [existingHousehold] = await tx
        .select({
          id: households.id,
        })
        .from(households)
        .where(and(eq(households.estateId, estateId), eq(households.id, householdId)))
        .limit(1);

      if (!existingHousehold) {
        throw new HouseholdNotFoundError();
      }

      // Delete all residents associated with household
      const deletedResidents = await tx
        .delete(residents)
        .where(and(eq(residents.estateId, estateId), eq(residents.householdId, householdId)))
        .returning({
          id: residents.id,
        });

      // Delete all vehicles associated with household

      // Delete household
      const deletedHouseholds = await tx
        .delete(households)
        .where(and(eq(households.id, householdId), eq(households.estateId, estateId)))
        .returning({
          id: households.id,
        });

      if (deletedHouseholds.length !== 1) {
        throw new HouseholdNotFoundError();
      }

      return {
        residentsCount: deletedResidents.length,
        householdCount: deletedHouseholds.length,
      };
    });

    // 5. Send response to user or caller
    householdLogs.info('Household successfully deleted', {
      deletedRecord,
      ...logContext,
    });
    return successResponseHelper('Household successfully deleted', {
      deletedRecord,
      ...logContext,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unexpected error while deleting household';

    if (error instanceof ZodError) {
      householdLogs.error('Household data validation failed', {
        ...logContext,
        message: errorMessage,
        error: error,
      });
      return errorResponseHelper(
        'Household data validation failed',
        'HOUSEHOLD_VALIDATION_ERROR',
        'Household data validation failed',
        error.issues,
      );
    }

    if (error instanceof HouseholdNotFoundError) {
      householdLogs.error('Household not found', {
        ...logContext,
        message: errorMessage,
        error: error,
      });
      return errorResponseHelper(
        'Household not found',
        'HOUSEHOLD_NOT_FOUND',
        'Household was not found within the specified estate',
      );
    }

    householdLogs.error('Unexpected error while deleting household', {
      ...logContext,
      message: errorMessage,
      error,
    });
    return errorResponseHelper(
      'Unable to delete household',
      'INTERNAL_SERVER_ERROR',
      'Unexpected error while deleting household',
    );
  }
};
