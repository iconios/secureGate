// Update Estate Payment Details Service
/*
#Plan:
1. Accept and validate inputs
2. Update/confirm payment by reference and payment_id
3. If already processed, stop
4. Verify user_id is linked to estate_id in estate_managers table
5. Update estate status to active
6. Fetch RPC details
7. Send email 
*/

import { randomUUID } from 'crypto';
import { sendEstateSubscriptionNotificationEmail } from '../../common/postmark/estateManagerPaymentUpdateEmail.js';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import logger from '../../common/winston/logger.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import {
  IPaymentEstateManagerDetails,
  IPaymentEstateManagerDetailsArgs,
} from '../estates/estate.types.js';
import UpdatePaymentByRefAndIdService from './update.payByRefAndId.service.js';

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
    service: 'UpdateEstateSubscriptionDetailsService',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate inputs
    const baseUrl = process.env.BASE_URL;
    if (
      !currency ||
      !reference ||
      !payment_id ||
      !baseUrl ||
      !email ||
      !amountInKobo ||
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

    // 2. Update/confirm payment by reference and payment_id
    const result = await UpdatePaymentByRefAndIdService(
      reference,
      payment_id,
      amountInKobo,
      currency,
    );
    if (!result.success) {
      return result;
    }

    // 3. If already processed, stop
    if (result.data?.alreadyProcessed) {
      estateLogs.info('Skipping estate update and email because payment was already processed', {
        reference: reference,
        payment_id: payment_id,
        estate_id: estate_id,
      });
      return result;
    }

    // 4. Verify user_id is linked to estate_id in estate_managers table
    const { data: estateManagerData, error: estateManagerError } = await supabaseAdmin
      .from('estate_managers')
      .select('id')
      .eq('manager_id', user_id)
      .eq('estate_id', estate_id)
      .maybeSingle();

    if (estateManagerError || !estateManagerData) {
      estateLogs.warn('Manager not found to be associated with estate or not found', {
        reference: reference,
      });
      return errorResponseHelper(
        'Manager not found to be associated with estate or not found',
        'MANAGER_ESTATE_MISMATCH_OR_NOT_FOUND',
        'Manager not found to be associated with estate or not found',
        estateManagerError ?? null,
      );
    }

    // 5. Update estate status to active
    const { error: updateError } = await supabaseAdmin
      .from('estates')
      .update({
        payment_id,
        status: 'active',
      })
      .eq('id', estate_id);

    if (updateError) {
      estateLogs.error('Error updating estate details after payment', {
        error: updateError,
      });
      return errorResponseHelper(
        'Error updating estate details after payment',
        'ESTATE_UPDATE_ERROR',
        'Error updating estate details after payment',
        updateError,
      );
    }

    // 6. Fetch RPC details
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
      p_payment_id: payment_id,
      p_estate_id: estate_id,
      p_plan_id: plan_id,
      p_manager_id: user_id,
    });

    if (rpcError || !rpcData) {
      estateLogs.error('Error fetching payment, estate and manager data', {
        error: rpcError ?? null,
      });
      return errorResponseHelper(
        'Error fetching payment, estate and manager data',
        'DATABASE_ERROR',
        'Error fetching payment, estate and manager data',
        rpcError ?? null,
      );
    }

    // 7. Send email
    const amountInNaira = (amountInKobo / 100) as number;
    const { payment_expires_at, estate_name, plan_name, period, full_name } = rpcData;
    return await sendEstateSubscriptionNotificationEmail(
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

export default UpdateEstatePaymentDetailsService;
