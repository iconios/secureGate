// Delete Unpaid Estate Entries Service
/*
#Plan:
1. Collate the unpaid payment entries
2. Fetch the estates and estates manager records for the unpaid payment entries collated
3. Delete the estates manager relationship record
4. Delete the estates record
5. Send response to caller
*/

import { inArray, isNull, ne, or, and, lt } from 'drizzle-orm';
import db from '../../../db/index.js';
import { estates } from '../../../db/schema/estates.js';
import { payments } from '../../../db/schema/payments.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const DeleteUnpaidEstateEntriesService = async () => {
  const estateDeleteLogs = logger.child({
    service: 'DeleteUnpaidEstateEntriesService',
    requestId: randomUUID(),
  });

  // 1. Collate the unpaid payment entries
  try {
    const cutoffTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // older than 30 minutes

    let unpaidEstateData: {
      id: string;
      name: string | null;
    }[] = [];

    await db.transaction(async (tx) => {
      const unpaidPaymentData = await tx
        .select({
          id: payments.id,
        })
        .from(payments)
        .where(
          and(
            or(ne(payments.status, 'paid'), isNull(payments.status)),
            lt(payments.createdAt, cutoffTime),
          ),
        );

      // 2. Fetch the estates and estates manager records for the unpaid payment entries collated
      const unpaidPaymentIds = unpaidPaymentData.map((payment) => payment.id);

      const deleteEstateCondition =
        unpaidPaymentIds.length > 0
          ? and(
              lt(estates.createdAt, cutoffTime),
              or(isNull(estates.paymentId), inArray(estates.paymentId, unpaidPaymentIds)),
            )
          : and(lt(estates.createdAt, cutoffTime), isNull(estates.paymentId));

      unpaidEstateData = await tx
        .select({
          id: estates.id,
          name: estates.name,
        })
        .from(estates)
        .where(deleteEstateCondition);

      if (unpaidEstateData.length === 0) {
        return;
      }

      const unpaidEstateIds = unpaidEstateData.map((estate) => estate.id);

      // 3. Delete the estates manager relationship record
      await tx.delete(estateManagers).where(inArray(estateManagers.estateId, unpaidEstateIds));

      // 4. Delete the estates record
      await tx.delete(estates).where(inArray(estates.id, unpaidEstateIds));
    });

    // 5. Send response to caller
    if (unpaidEstateData.length === 0) {
      estateDeleteLogs.warn('No estate with unpaid payment entry found for deletion');

      return successResponseHelper('No estate with unpaid payment entry found for deletion', {
        deletedCount: 0,
        unpaidEstateData: [],
      });
    }

    estateDeleteLogs.info('Estates with unpaid payment entry found and deleted', {
      deletedCount: unpaidEstateData.length,
      unpaidEstateData,
    });

    return successResponseHelper('Estates with unpaid payment entry found and deleted', {
      deletedCount: unpaidEstateData.length,
      unpaidEstateData,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error while deleting unpaid estate data';

    estateDeleteLogs.error('Failed to delete unpaid estate entries', {
      message: errorMessage,
      cause: (error as any)?.cause,
      error,
    });

    return errorResponseHelper(errorMessage, 'INTERNAL_SERVER_ERROR', errorMessage, error);
  }
};
