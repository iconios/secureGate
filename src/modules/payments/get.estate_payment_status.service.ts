// Get Estate Payment Status Service
/*
#Plan:
1. Validate that the callback reference exists and is a string.
2. Find the local payment record by reference.
3. Redirect to payment-not-found or failed-payment page if no payment record exists.
4. Redirect to successful-payment page if payment is already marked as paid.
5. Verify unpaid payment directly with Paystack using the reference.
6. Keep payment pending and redirect to pending-payment page if Paystack verification fails.
7. Update payment status and redirect to failed or pending-payment page if Paystack status is not success.
8. Extract verified Paystack data and metadata if Paystack confirms success.
9. Validate Paystack reference, amount, currency, and metadata against local payment data.
10. Validate that the linked manager can manage the estate through the estate-manager table.
11. Call UpdatePaymentByRefAndIdService with reference, payment_id, amountInKobo, and currency.
12. Redirect based on error type if UpdatePaymentByRefAndIdService fails.
13. Skip estate update and email if payment was already processed, then redirect to success.
14. Activate the estate and attach payment_id if payment was newly marked as paid.
15. Fetch payment, estate, plan, and manager email details using RPC.
16. Send confirmation email only for a newly processed payment.
17. Redirect user to successful-payment page.
*/

import { randomUUID } from 'crypto';
import { sendEstateSubscriptionNotificationEmail } from '../../common/postmark/estateManagerPaymentUpdateEmail.js';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import logger from '../../common/winston/logger.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import {
  IPaymentEstateManagerDetails,
  IPaymentEstateManagerDetailsArgs,
} from '../estates/estate.types.js';
import { PaystackVerifyResponse } from './payment.types.js';
import UpdatePaymentByRefAndIdService from './update.payByRefAndId.service.js';

const GetEstatePaymentStatusService = async (reference: string) => {
  const estateLogs = logger.child({
    service: 'GetEstatePaymentStatusService',
    requestId: randomUUID(),
  });

  try {
    // 1. Validate that the callback reference exists and is a string.
    if (!reference) {
      estateLogs.warn('Payment reference is required', {
        reference: reference,
      });
      return errorResponseHelper(
        'Payment reference is required',
        'PAYMENT_REFERENCE_REQUIRED',
        'Payment reference is required',
      );
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      estateLogs.warn('Payment gateway key is required', {
        reference: reference,
      });
      return errorResponseHelper(
        'Payment gateway key is required',
        'PAYMENT_KEY_REQUIRED',
        'Payment gateway key is required',
      );
    }

    const baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      estateLogs.warn('Base url required', {
        reference: reference,
      });
      return errorResponseHelper('Base url required', 'BASE_URL_REQUIRED', 'Base url required');
    }

    // 2. Find the local payment record by reference.
    const { data: paymentData, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select(
        'id, period, reference, status, amount, currency, estate_id, plan_id, paid_by, payer_email',
      )
      .eq('reference', reference)
      .maybeSingle();

    // 3. Redirect to payment-not-found or failed-payment page if no payment record exists.
    if (paymentError || !paymentData) {
      estateLogs.error('Payment data not found', {
        reference: reference,
        error: paymentError ?? null,
      });
      return errorResponseHelper(
        'Payment data not found',
        'PAYMENT_DATA_NOT_FOUND',
        'Payment data not found',
      );
    }

    // 4. Redirect to successful-payment page if payment is already marked as paid.
    if (paymentData.status === 'paid') {
      estateLogs.info('Payment already marked paid', {
        reference: reference,
        payment_id: paymentData.id,
      });
      return successResponseHelper('Payment already marked paid', {
        reference: reference,
      });
    }

    // 5. Verify unpaid payment directly with Paystack using the reference.
    let result: PaystackVerifyResponse;

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      // 6. Keep payment pending and redirect to pending-payment page if Paystack verification fails.
      if (!response.ok) {
        estateLogs.error('Paystack verification API error', {
          reference,
          status: response.status,
          statusText: response.statusText,
        });

        return errorResponseHelper(
          'Payment verification is pending. Please try again shortly.',
          'PAYSTACK_VERIFICATION_API_ERROR',
          'Payment verification is pending. Please try again shortly.',
        );
      }

      result = (await response.json()) as PaystackVerifyResponse;
    } catch (error) {
      estateLogs.error('Paystack verification network/server error', {
        reference,
        error,
      });

      return errorResponseHelper(
        'Payment verification is pending. Please try again shortly.',
        'PAYSTACK_VERIFICATION_NETWORK_ERROR',
        'Payment verification is pending. Please try again shortly.',
        error,
      );
    }

    // 7. Update payment status and redirect to failed or pending-payment page if Paystack status is not success.
    if (!result?.status || !result?.data) {
      estateLogs.warn('Unable to verify payment at this time', {
        reference: reference,
        payment_id: paymentData.id,
      });
      return errorResponseHelper(
        'Unable to verify payment at this time',
        'PAYSTACK_VERIFICATION_PENDING',
        'Unable to verify payment at this time',
      );
    }

    if (result.data.status !== 'success') {
      const { error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          status: result.data.status ?? 'failed',
        })
        .eq('reference', reference)
        .eq('id', paymentData.id);

      if (updateError) {
        estateLogs.error('Error updating payment data', {
          reference: reference,
          payment_id: paymentData.id,
          error: updateError,
        });
        return errorResponseHelper(
          'Error updating payment data',
          'PAYMENT_UPDATE_ERROR',
          'Error updating payment data',
        );
      }

      estateLogs.warn('Payment was not successful', {
        reference: reference,
        payment_id: paymentData.id,
      });
      return errorResponseHelper(
        'Payment was not successful',
        'PAYMENT_NOT_SUCCESSFUL',
        'Payment was not successful',
      );
    }

    // 8. Extract verified Paystack data and metadata if Paystack confirms success.
    const { reference: paystackRef, amount, currency } = result.data;
    const { payment_id, estate_id, user_id, plan_id, period } = result.data.metadata;

    // 9. Validate Paystack reference, amount, currency, and metadata against local payment data.
    if (paystackRef !== reference) {
      estateLogs.warn('Payment reference mismatch', {
        reference: reference,
        payment_id: paymentData.id,
        received: paystackRef,
        expected: reference,
      });

      return errorResponseHelper(
        'Payment reference mismatch',
        'PAYMENT_REF_MISMATCH',
        'Payment reference mismatch',
      );
    }

    const amountInKobo = Math.round(Number(paymentData.amount) * 100);
    if (amountInKobo !== Number(amount)) {
      estateLogs.warn('Payment amount mismatch', {
        reference: reference,
        payment_id: paymentData.id,
        received: amount,
        expected: amountInKobo,
      });

      return errorResponseHelper(
        'Payment amount mismatch',
        'PAYMENT_AMOUNT_MISMATCH',
        'Payment amount mismatch',
      );
    }

    if (currency !== paymentData.currency) {
      estateLogs.warn('Payment currency mismatch', {
        reference: reference,
        payment_id: paymentData.id,
        received: currency,
        expected: paymentData.currency,
      });

      return errorResponseHelper(
        'Payment currency mismatch',
        'PAYMENT_CURRENCY_MISMATCH',
        'Payment currency mismatch',
      );
    }

    if (estate_id !== paymentData.estate_id) {
      estateLogs.warn('Estate identity mismatch', {
        reference: reference,
        payment_id: paymentData.id,
        received: estate_id,
        expected: paymentData.estate_id,
      });

      return errorResponseHelper(
        'Estate identity mismatch',
        'ESTATE_IDENTITY_MISMATCH',
        'Estate identity mismatch',
      );
    }

    if (plan_id !== paymentData.plan_id) {
      estateLogs.warn('Estate subscription plan mismatch', {
        reference: reference,
        payment_id: paymentData.id,
        received: plan_id,
        expected: paymentData.plan_id,
      });

      return errorResponseHelper(
        'Estate subscription plan mismatch',
        'ESTATE_SUBSCRIPTION_PLAN_MISMATCH',
        'Estate subscription plan mismatch',
      );
    }

    if (user_id !== paymentData.paid_by) {
      estateLogs.warn('Estate manager identity mismatch', {
        reference: reference,
        payment_id: paymentData.id,
        received: user_id,
        expected: paymentData.paid_by,
      });
      return errorResponseHelper(
        'Estate manager identity mismatch',
        'MANAGER_IDENTITY_MISMATCH',
        'Estate manager identity mismatch',
      );
    }

    if (payment_id !== paymentData.id) {
      estateLogs.warn('Payment identity mismatch', {
        reference: reference,
        payment_id: paymentData.id,
        received: payment_id,
        expected: paymentData.id,
      });

      return errorResponseHelper(
        'Payment identity mismatch',
        'PAYMENT_IDENTITY_MISMATCH',
        'Payment identity mismatch',
      );
    }

    if (period !== paymentData.period) {
      estateLogs.warn('Subscription period mismatch', {
        reference: reference,
        payment_id: paymentData.id,
        received: period,
        expected: paymentData.period,
      });

      return errorResponseHelper(
        'Subscription period mismatch',
        'SUBSCRIPTION_PERIOD_MISMATCH',
        'Subscription period mismatch',
      );
    }

    // 10. Validate that the linked manager can manage the estate through the estate-manager table.
    const { data: relationshipData, error: relationshipError } = await supabaseAdmin
      .from('estate_managers')
      .select('id')
      .eq('manager_id', paymentData.paid_by)
      .eq('estate_id', paymentData.estate_id)
      .maybeSingle();

    if (relationshipError || !relationshipData) {
      estateLogs.error('No estate manager relationship exists', {
        reference: reference,
        payment_id: paymentData.id,
        error: relationshipError ?? null,
      });

      return errorResponseHelper(
        'No estate manager relationship exists',
        'ESTATE_MANAGER_RELATIONSHIP_NOT_FOUND',
        'No estate manager relationship exists',
      );
    }

    // 11. Call UpdatePaymentByRefAndIdService with reference, payment_id, amountInKobo, and currency.
    const updateResult = await UpdatePaymentByRefAndIdService(
      paymentData.reference,
      paymentData.id,
      amountInKobo,
      paymentData.currency,
    );

    // 12. Redirect based on error type if UpdatePaymentByRefAndIdService fails.
    // 13. Skip estate update and email if payment was already processed, then redirect to success.
    if (!updateResult.success || updateResult.data?.alreadyProcessed) {
      return updateResult;
    }

    // 14. Activate the estate and attach payment_id if payment was newly marked as paid.
    if (!updateResult.data?.alreadyProcessed) {
      const { error: updateError } = await supabaseAdmin
        .from('estates')
        .update({
          status: 'active',
          payment_id: paymentData.id,
        })
        .eq('id', paymentData.estate_id);

      if (updateError) {
        estateLogs.error('Error updating estate data', {
          reference: reference,
          payment_id: paymentData.id,
          error: updateError,
        });

        return errorResponseHelper(
          'Error updating estate data',
          'ESTATE_UPDATE_ERROR',
          'Error updating estate data',
        );
      }
    }

    // 15. Fetch payment, estate, plan, and manager email details using RPC.
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc<
      'get_payment_estate_manager_details',
      IPaymentEstateManagerDetailsArgs & Record<string, unknown>,
      {
        Row: IPaymentEstateManagerDetails;
        Result: IPaymentEstateManagerDetails;
        RelationName: 'get_payment_estate_manager_details';
        Relationships: null;
      }
    >('get_payment_estate_manager_details', {
      p_payment_id: paymentData.id,
      p_estate_id: paymentData.estate_id,
      p_plan_id: paymentData.plan_id,
      p_manager_id: paymentData.paid_by,
    });

    if (rpcError || !rpcData) {
      estateLogs.error('Error fetching payment, estate and manager data', {
        reference,
        payment_id: paymentData.id,
        error: rpcError ?? null,
      });
      return errorResponseHelper(
        'Error fetching payment, estate and manager data',
        'DATABASE_ERROR',
        'Error fetching payment, estate and manager data',
        rpcError ?? null,
      );
    }

    // 16. Send confirmation email only for a newly processed payment.
    const { payment_expires_at, estate_name, plan_name, full_name } = rpcData;
    const emailResult = await sendEstateSubscriptionNotificationEmail(
      paymentData.payer_email,
      full_name,
      estate_name,
      plan_name,
      paymentData.currency,
      paymentData.amount,
      paymentData.reference,
      payment_expires_at,
      paymentData.period,
      baseUrl,
    );

    if (!emailResult.success) {
      estateLogs.warn('Payment confirmed but email sending failed', {
        reference,
        payment_id,
      });
    }

    // 17. Redirect user to successful-payment page.
    return successResponseHelper('Payment confirmed successfully', {
      reference,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Error updating estate subscription details with payment data';
    estateLogs.error(errorMessage, {
      error: error,
    });
    return errorResponseHelper(errorMessage, 'INTERNAL_SERVER_ERROR', errorMessage, error);
  }
};

export default GetEstatePaymentStatusService;
