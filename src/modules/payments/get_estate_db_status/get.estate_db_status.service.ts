// Get Estate Database Status Service
/*
#Plan:
1. Get and validate estate reference
2. Confirm that the reference exists and the estate is not deleted and is associated with the manager id
3. Get the details of the estate and its payment details and send to the client
*/

import db from '../../../db/index.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { estates } from '../../../db/schema/estates.js';
import { payments } from '../../../db/schema/payments.js';
import { subscriptionPlans } from '../../../db/schema/subscriptionPlans.js';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { eq, isNull, and } from 'drizzle-orm';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const GetEstateDatabaseStatusService = async (reference: string, user_id: string) => {
  const estateLogs = logger.child({
    service: 'GetEstateDatabaseStatusService',
    requestId: randomUUID(),
  });

  try {
    // 1. Get and validate estate reference
    if (!reference?.trim()) {
      estateLogs.warn('Reference is required');
      return errorResponseHelper(
        'Reference is required',
        'REFERENCE_REQUIRED',
        'Reference is required',
      );
    }

    if (!user_id?.trim()) {
      estateLogs.warn('User id is required', {
        reference: reference,
      });
      return errorResponseHelper(
        'User id is required',
        'USER_IDENTITY_REQUIRED',
        'User id is required',
      );
    }

    // 2. Confirm that the reference exists and the estate is not deleted and is associated with the manager id
    const estatePaymentData = await db
      .select({
        estate_name: estates.name,
        subscription_amount: payments.amount,
        payment_reference: payments.reference,
        household_limit: subscriptionPlans.householdLimit,
        plan_name: subscriptionPlans.name,
      })
      .from(payments)
      .innerJoin(estates, and(eq(payments.estateId, estates.id), isNull(estates.deletedAt)))
      .innerJoin(subscriptionPlans, eq(payments.planId, subscriptionPlans.id))
      .innerJoin(
        estateManagers,
        and(eq(estateManagers.managerId, user_id), eq(estateManagers.estateId, payments.estateId)),
      )
      .where(eq(payments.reference, reference))
      .limit(1);

    // 3. Get the details of the estate and its payment details and send to the client
    const estatePayment = estatePaymentData[0];

    if (!estatePayment) {
      estateLogs.info('No estate payment data found', {
        reference: reference,
        user_id: user_id,
      });

      return successResponseHelper('No estate payment data found', {
        found: false,
        reference,
      });
    }

    estateLogs.info('Estate payment data found', {
      reference: reference,
      user_id,
    });

    return successResponseHelper('Estate payment data found', {
      found: true,
      estate_payment: estatePayment,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    estateLogs.error('Failed to get estate database status', {
      error: errorMessage,
      reference: reference ?? null,
      user_id: user_id ?? null,
    });

    return errorResponseHelper(
      'Something went wrong while getting estate payment data',
      'SERVER_ERROR',
      'Something went wrong while getting estate payment data',
      error,
    );
  }
};
