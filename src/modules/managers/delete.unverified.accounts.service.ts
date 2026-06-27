// Delete Unverified Manager Accounts Service
/*
#Plan:
1. Collate and delete the unverified manager accounts after 24 hours
2. Send response to caller
*/

import { and, eq, isNull, lte, or } from 'drizzle-orm';
import db from '../../db/index.js';
import { managers } from '../../db/schema/managers.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';

export const DeleteUnverifiedManagerAccountsService = async () => {
  const managerLogs = logger.child({
    service: 'DeleteUnverifiedManagerAccountsService',
    requestId: randomUUID(),
  });

  try {
    // 1. Collate and delete the unverified manager accounts after 24 hours
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // older than 24 hours

    const unverifiedManagersData = await db
      .delete(managers)
      .where(
        and(
          lte(managers.createdAt, cutoffTime),
          or(isNull(managers.isVerified), eq(managers.isVerified, false)),
        ),
      )
      .returning({
        id: managers.id,
        email: managers.email,
      });

    // 2. Send response to caller
    if (!unverifiedManagersData || unverifiedManagersData.length === 0) {
      managerLogs.info('No unverified manager accounts found for deletion', {
        deletedCount: 0,
        unverifiedAccounts: [],
      });
      return successResponseHelper('No unverified manager accounts found for deletion', {
        deletedCount: 0,
        unverifiedAccounts: [],
      });
    }

    const unverifiedAccounts = unverifiedManagersData.map((data) => ({
      id: data.id,
      email: redactEmailUsername(data.email),
    }));
    managerLogs.info('Unverified manager accounts found and deleted', {
      deletedCount: unverifiedManagersData.length,
      unverifiedAccounts,
    });

    return successResponseHelper('Unverified manager accounts found and deleted', {
      deletedCount: unverifiedManagersData.length,
      unverifiedAccounts,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error during unverified manager accounts collation and deletion';
    managerLogs.error(
      'Unexpected error during unverified manager accounts collation and deletion',
      {
        message: errorMessage,
        error,
      },
    );

    return errorResponseHelper(
      'Unexpected error during unverified manager accounts collation and deletion',
      'UNEXPECTED_ERROR',
      'Unexpected error during unverified manager accounts collation and deletion',
      error,
    );
  }
};
