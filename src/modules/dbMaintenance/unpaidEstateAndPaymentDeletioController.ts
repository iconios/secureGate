// Unpaid Estate And Payment Entries Deletion Controller
/*
Plan:
1. Call the unpaid estate entries deletion service
2. Call the unpaidpayment entries deletion service
3. Send the response back to the client
*/
import { Request, Response } from 'express';
import { DeleteUnpaidEstateEntriesService } from '../estates/delete_unpaid_estate_entries/delete.unpaid.estate.entries.service.js';
import { DeleteUnpaidPaymentEntriesService } from '../payments/delete_unpaid_entries/delete.unpaid.entries.service.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const UnpaidEstateAndPaymentEntriesDeletionController = async (
  req: Request,
  res: Response,
) => {
  const dbMaintenanceLogs = logger.child({
    service: 'UnpaidEstateAndPaymentEntriesDeletionController',
    requestId: randomUUID(),
  });

  try {
    // 1. Call the unpaid estate entries deletion service
    const estateDeletionResult = await DeleteUnpaidEstateEntriesService();
    if (!estateDeletionResult.success) {
      return res.status(500).json(estateDeletionResult);
    }

    // 2. Call the unpaid payment entries deletion service
    const paymentDeletionResult = await DeleteUnpaidPaymentEntriesService();
    if (!paymentDeletionResult.success) {
      return res.status(500).json(paymentDeletionResult);
    }

    // 3. Send the response back to the client
    dbMaintenanceLogs.info('Unpaid estate and payment cleanup completed');
    return res.status(200).json(
      successResponseHelper('Unpaid estate and payment entries cleanup completed', {
        estateDeletionResult,
        paymentDeletionResult,
      }),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    dbMaintenanceLogs.error('Unexpected controller error during unpaid cleanup', {
      message: errorMessage,
      error,
    });

    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Internal Server Error',
          'INTERNAL_SERVER_ERROR',
          'An unexpected error occurred',
          error,
        ),
      );
  }
};
