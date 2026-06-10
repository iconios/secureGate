// Update Payment By Reference And Id Service
/*
#Plan:
1. Accept and validate the payment details
2. Verify that the payment record exists
3. Verify that payment hasn't already been processed
4. Verify that the paystack-sent amount is the same as amount stored on db
5. Verify that paystack-sent currency is the same as currency stored on db 
6. Update the payment details:
    status = "paid"
    paid_at = now
7. Send response to the caller
*/

import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import logger from '../../common/winston/logger.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';

const UpdatePaymentByRefAndIdService = async (
  reference: string,
  payment_id: string,
  amountInKobo: number,
  currency: string,
) => {
  const paymentLogs = logger.child({
    service: 'UpdatePaymentByRefAndIdService',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the payment details
    if (!reference || !payment_id || !amountInKobo || !currency) {
      paymentLogs.warn('Payment arguments required');
      return errorResponseHelper(
        'Payment arguments required',
        'PAYMENT_ARGUMENTS_NOT_FOUND',
        'Payment arguments required',
      );
    }

    // 2. Verify that the payment record exists
    const { data: paymentData, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, currency, status, amount')
      .eq('reference', reference)
      .neq('status', 'paid')
      .eq('id', payment_id)
      .maybeSingle();

    if (paymentError || !paymentData) {
      paymentLogs.error('Payment reference not found', {
        error: paymentError ?? null,
        reference: reference,
        payment_id: payment_id,
      });
      return errorResponseHelper(
        'Payment reference not found',
        'PAYMENT_NOT_FOUND_OR_ERROR',
        'Payment reference not found',
        paymentError ?? null,
      );
    }

    // 3. Verify that payment hasn't already been processed
    if (paymentData.status === 'paid') {
      paymentLogs.warn('Payment already processed', {
        reference: reference,
        payment_id: payment_id,
      });

      return successResponseHelper('Payment already processed', {
        reference,
        alreadyProcessed: true,
      });
    }

    // 4. Verify that the paystack-sent amount is the same as amount stored on db
    const amountInNaira = (amountInKobo / 100) as number;
    if (Number(paymentData.amount) !== amountInNaira) {
      paymentLogs.warn('Payment amount mismatch', {
        reference: reference,
        payment_id: payment_id,
        paystackSent: amountInNaira,
        expected: paymentData.amount,
      });

      return errorResponseHelper(
        'Payment amount mismatch',
        'PAYMENT_AMOUNT_MISMATCH',
        'Payment amount mismatch',
      );
    }

    // 5. Verify that paystack-sent currency is the same as currency stored on db
    if (paymentData.currency !== currency) {
      paymentLogs.warn('Payment currency mismatch', {
        reference: reference,
        payment_id: payment_id,
        payStackSent: currency,
        expected: paymentData.currency,
      });

      return errorResponseHelper(
        'Payment currency mismatch',
        'PAYMENT_CURRENCY_MISMATCH',
        'Payment currency mismatch',
      );
    }
    /*
        6. Update the payment details:
            status = "paid"
            paid_at = now
        */
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', payment_id)
      .neq('status', 'paid')
      .eq('reference', reference)
      .select('id')
      .maybeSingle();

    if (updateError) {
      paymentLogs.error('Error updating payment details', {
        error: updateError,
        reference: reference,
        payment_id: payment_id,
      });
      return errorResponseHelper(
        'Error updating payment details',
        'PAYMENT_UPDATE_ERROR',
        'Error updating payment details',
        updateError,
      );
    }

    if (!updateData) {
      paymentLogs.info('Payment already processed', {
        reference: reference,
        payment_id: payment_id,
      });

      return successResponseHelper('Payment already processed', {
        reference,
        alreadyProcessed: true,
      });
    }

    // 7. Send response to the caller
    paymentLogs.info('Payment processed and confirmed', {
      reference: reference,
      payment_id: payment_id,
    });
    return successResponseHelper('Payment processed and confirmed', {
      reference,
      alreadyProcessed: false,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error while updating payment details';

    paymentLogs.error(errorMessage, {
      error: error,
      reference: reference,
      payment_id: payment_id,
    });
    return errorResponseHelper(errorMessage, 'INTERNAL_SERVER_ERROR', errorMessage, error);
  }
};

export default UpdatePaymentByRefAndIdService;
