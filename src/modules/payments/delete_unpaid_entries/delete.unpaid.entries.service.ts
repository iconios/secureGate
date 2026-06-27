// Delete Unpaid Payment Entries Service
/*
#Plan:
1. Collate all unpaid payment records and delete all of them
2. Send response to caller
*/

import { and, isNull, lt, ne, or } from 'drizzle-orm';
import db from '../../../db/index.js';
import { payments } from '../../../db/schema/payments.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';

export const DeleteUnpaidPaymentEntriesService = async () => {
  const payDeleteLogs = logger.child({
    service: 'DeleteUnpaidPaymentEntriesService',
    requestId: randomUUID(),
  });

  try {
    // 1. Collate and delete unpaid/null payment records older than 30 minutes
    const cutoffTime = new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(); // older than 30 minutes
    const unpaidPaymentData = await db
      .delete(payments)
      .where(
        and(
          or(ne(payments.status, 'paid'), isNull(payments.status)),
          lt(payments.createdAt, cutoffTime),
        ),
      )
      .returning({
        id: payments.id,
        reference: payments.reference,
      });

    // 2. Send response to caller
    if (!unpaidPaymentData || unpaidPaymentData.length === 0) {
      payDeleteLogs.info('No unpaid or null payment entries found for deletion');
      return successResponseHelper('No unpaid or null payment entries found for deletion');
    }

    payDeleteLogs.info('Unpaid or null payment entries found and deleted', {
      deletedCount: unpaidPaymentData.length,
      unpaidPaymentData,
    });
    return successResponseHelper('Unpaid or null payment entries found and deleted', {
      deletedCount: unpaidPaymentData.length,
      unpaidPaymentData,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error during unpaid or null payment entries deletion';
    payDeleteLogs.error('Failed to delete unpaid payment entries', {
      message: errorMessage,
      error: error,
    });
    return errorResponseHelper(errorMessage, 'INTERNAL_SERVER_ERROR', errorMessage, error);
  }
};
