// Update Estate Payment Details Service
/*
#Plan:
1. Accept and validate inputs
2. Verify user_id is linked to estate_id in estate_managers table
3. Update/confirm payment by reference and payment_id
4. If already processed, continue and ensure estate is active
5. Update estate status to active
6. Fetch RPC details
7. Send email 
*/

import { randomUUID } from 'crypto';
import { sendEstateSubscriptionNotificationEmail } from '../../common/postmark/estateManagerPaymentUpdateEmail.js';
import logger from '../../common/winston/logger.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { IPaymentEstateManagerDetails } from '../estates/estate.types.js';
import UpdatePaymentByRefAndIdService from './update.payByRefAndId.service.js';
import db from '../../db/index.js';
import { estateManagers } from '../../db/schema/estateManagers.js';
import { eq, and, sql } from 'drizzle-orm';
import { estates } from '../../db/schema/estates.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';

const UpdateEstatePaymentDetailsService = async (
  email: string,
  amountInKobo: number,
  reference: string,
  payment_id: string,
  estate_id: string,
  user_id: string,
  plan_id: string,
  currency: string,
) => {
  const estateLogs = logger.child({
    service: 'UpdateEstatePaymentDetailsService',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate inputs
    const baseUrl = process.env.FRONTEND_URL;
    if (
      !currency ||
      !reference ||
      !payment_id ||
      !baseUrl ||
      !email ||
      typeof amountInKobo !== 'number' ||
      amountInKobo <= 0 ||
      !estate_id ||
      !user_id ||
      !plan_id
    ) {
      estateLogs.warn('Payment arguments required', {
        hasEmail: Boolean(email),
        amountInKobo: amountInKobo,
        reference: reference,
        payment_id: payment_id,
        estate_id: estate_id,
        user_id: user_id,
        plan_id: plan_id,
        hasBaseUrl: Boolean(baseUrl),
        currency: currency,
      });
      return errorResponseHelper(
        'Payment arguments required',
        'PAYMENT_ARGUMENTS_NOT_FOUND',
        'Payment arguments required',
      );
    }

    // 2. Verify user_id is linked to estate_id in estate_managers table
    const [estateManagerData] = await db
      .select({ id: estateManagers.id })
      .from(estateManagers)
      .where(and(eq(estateManagers.managerId, user_id), eq(estateManagers.estateId, estate_id)))
      .limit(1);

    if (!estateManagerData) {
      estateLogs.warn('Manager not found to be associated with estate', {
        reference: reference,
      });
      return errorResponseHelper(
        'Manager not found to be associated with estate',
        'MANAGER_ESTATE_MISMATCH_OR_NOT_FOUND',
        'Manager not found to be associated with estate',
      );
    }

    // 3. Update/confirm payment by reference and payment_id
    const result = await UpdatePaymentByRefAndIdService(
      reference,
      payment_id,
      amountInKobo,
      currency,
    );
    if (!result.success) {
      return result;
    }

    // 4. If already processed, continue and ensure estate is active
    const alreadyProcessed = Boolean(result.data?.alreadyProcessed);

    if (alreadyProcessed) {
      estateLogs.info('Payment already processed, ensuring estate is active', {
        reference,
        payment_id,
        estate_id,
      });
    }

    // 5. Update estate status to active
    const [updatedEstate] = await db
      .update(estates)
      .set({
        paymentId: payment_id,
        status: 'active',
      })
      .where(eq(estates.id, estate_id))
      .returning({
        id: estates.id,
      });

    if (!updatedEstate) {
      estateLogs.error('Estate not found while updating payment status', {
        estate_id,
        payment_id,
        reference,
      });

      return errorResponseHelper(
        'Estate not found while updating payment status',
        'ESTATE_NOT_FOUND',
        'Estate not found while updating payment status',
      );
    }

    // 6. Fetch RPC details
    const fetchPaymentEstateManagerDetails = async (
      paymentId: string,
      estateId: string,
      planId: string,
      managerId: string,
    ): Promise<IPaymentEstateManagerDetails | null> => {
      const result = await db.execute(
        sql`
      SELECT get_payment_estate_manager_details(
        ${paymentId},
        ${estateId},
        ${planId},
        ${managerId}
      ) AS details
    `,
      );

      const row = result[0] as { details?: unknown } | undefined;

      if (!row?.details || typeof row.details !== 'object') {
        return null;
      }

      const details = row.details as Partial<IPaymentEstateManagerDetails>;

      if (
        !details.payment_expires_at ||
        !details.estate_name ||
        !details.plan_name ||
        !details.currency ||
        !details.full_name ||
        !details.period
      ) {
        return null;
      }

      return details as IPaymentEstateManagerDetails;
    };

    const rpcDetails = await fetchPaymentEstateManagerDetails(
      payment_id,
      estate_id,
      plan_id,
      user_id,
    );

    if (!rpcDetails) {
      estateLogs.error('Error fetching the payment, estate and manager details', {
        estate_id,
        payment_id,
        reference,
        user_id,
      });

      return errorResponseHelper(
        'Error fetching the payment, estate and manager details',
        'PAYMENT_ESTATE_MANAGER_FETCH_ERROR',
        'Error fetching the payment, estate and manager details',
      );
    }

    const { payment_expires_at, estate_name, plan_name, period, full_name } = rpcDetails;

    if (!payment_expires_at || !estate_name || !plan_name || !period || !full_name) {
      estateLogs.error('Incomplete payment, estate and manager data', {
        payment_expires_at,
        estate_name,
        plan_name,
        period,
        full_name,
        rpcDetails,
      });

      return errorResponseHelper(
        'Incomplete payment, estate and manager data',
        'DATABASE_ERROR',
        'Incomplete payment, estate and manager data',
      );
    }

    // 7. Send email
    const amountInNaira = amountInKobo / 100;

    try {
      await sendEstateSubscriptionNotificationEmail(
        email,
        full_name,
        estate_name,
        plan_name,
        currency,
        amountInNaira,
        reference,
        payment_expires_at,
        period,
        baseUrl,
      );
    } catch (emailError) {
      estateLogs.error('Payment processed but notification email failed', {
        error: emailError,
        email,
        reference,
        payment_id,
        estate_id,
      });
    }

    estateLogs.info('Estate payment details updated successfully', {
      reference,
      payment_id,
      estate_id,
      alreadyProcessed: false,
    });
    return successResponseHelper('Estate payment details updated successfully', {
      reference,
      payment_id,
      estate_id,
      alreadyProcessed: false,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Error updating estate subscription details with payment data';
    estateLogs.error(errorMessage, {
      error: error,
      reference,
      payment_id,
      estate_id,
      user_id,
      plan_id,
    });
    return errorResponseHelper(errorMessage, 'INTERNAL_SERVER_ERROR', errorMessage, error);
  }
};

export default UpdateEstatePaymentDetailsService;
