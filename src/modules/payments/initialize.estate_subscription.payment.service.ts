// Initialize Estate Subscription Payment Service
/*
#Plan:
1. Accept and validate input:
   - user_id
   - plan_id
   - period
   - estate name
   - logo_url
   - location
   - state
2. Validate:
   - authenticated user exists
   - email belongs to authenticated user, or use authenticated user's email directly
   - plan_id exists
   - period is allowed: monthly/yearly
   - selected plan supports the requested household limit
3. Get pricing from backend/database:
   - fetch plan by plan_id
   - calculate amount from plan price and period
   - convert amount to Paystack subunit, e.g. NGN naira to kobo
4. Create estate record:
   - name
   - location
   - state
   - logo_url
   - plan_id
   - number_of_households
   - status: pending_payment
5. Create an estate manager record:
   - user_id,
   - estate_id
6. Create payment record:
   - estate_id
   - paid_by
   - amount
   - expires_at
   - plan_id
   - purpose: estate_subscription_initial_payment
   - status: pending
   - reference: generated unique reference
   - currency: "NGN",
   - provider: "paystack"
7. Initialize Paystack transaction:
   - email
   - amount in kobo
   - reference from payment record
   - callback_url
   - metadata:
       estate_id
       payment_id
       user_id
       plan_id
       period
       purpose
8. Save Paystack initialization response:
   - authorization_url
   - access_code
   - provider_response
   - initialized_at
   - status: "pending"
9. Return to caller:
   - payment_id
   - estate_id
   - reference
   - authorization_url
   - access_code
*/

import { ZodError } from 'zod';
import {
  InitializeEstatePaymentInput,
  InitializeEstatePaymentInputSchema,
} from './payment.types.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import { generatePaymentReference } from '../../utils/generatePaymentRefefHelper.js';
import { initializePaystackTransactionService } from './initializePaystackTransaction.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';

const InitializeEstatesubscriptionPaymentService = async (input: InitializeEstatePaymentInput) => {
  const initializePayLogs = logger.child({
    service: 'InitializeEstatesubscriptionPaymentService',
    requestId: randomUUID(),
  });

  try {
    const baseUrl = process.env.BASE_URL;

    if (!baseUrl) {
      initializePayLogs.error('Missing base url configuration');

      return errorResponseHelper(
        'Missing base url configuration',
        'MISSING_BASE_URL',
        'BASE_URL is required for payment callback URL',
      );
    }
    /*
      Step 1. Accept and validate input:
      - user_id
      - plan_id
      - period
      - estate name
      - logo_url
      - location
      - state
      */
    const { user_id, plan_id, period, name, logo_url, location, state } =
      InitializeEstatePaymentInputSchema.parse(input);

    /*
      Step 2. Validate:
      - authenticated user exists
      - email belongs to authenticated user, or use authenticated user's email directly
      - plan_id exists
      - period is allowed: monthly/yearly
      - selected plan supports the requested household limit
      */
    const { data: userData, error: userError } = await supabaseAdmin
      .from('managers')
      .select('id, email, full_name')
      .eq('id', user_id)
      .eq('is_verified', true)
      .maybeSingle();

    if (!userData || userError) {
      initializePayLogs.error('Manager not found or not verified', {
        userId: user_id,
      });
      return errorResponseHelper(
        'Manager not found or not verified',
        'MANAGER_NOT_FOUND',
        'Manager not found or not verified',
        userError ?? null,
      );
    }

    const { data: planData, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, status, monthly_fee, yearly_fee, household_limit')
      .eq('id', plan_id)
      .eq('status', 'active')
      .single();

    if (planError || !planData) {
      initializePayLogs.error('No plan with the selected id', {
        email: redactEmailUsername(userData.email),
      });
      return errorResponseHelper(
        'No plan with the selected id',
        'PLAN_NOT_FOUND',
        'Selected plan id not found',
        planError,
      );
    }

    /*
      Step 3. Get pricing from backend/database:
      - fetch plan by plan_id
      - calculate amount from plan price and period
      - convert amount to Paystack subunit, e.g. NGN naira to kobo
      */
    const amountInNaira = period === 'monthly' ? planData.monthly_fee : planData.yearly_fee;
    const amountInKobo = amountInNaira * 100;

    /*
     Step 4. Create estate record:
      - name
      - location
      - state
      - logo_url
      - plan_id
      - number_of_households
      - status: pending_payment
     */
    const { data: estateData, error: estateError } = await supabaseAdmin
      .from('estates')
      .insert({
        name,
        location,
        state,
        logo_url,
        plan_id,
        status: 'pending_payment',
        number_of_households: 0,
      })
      .select('id')
      .single();

    if (estateError) {
      initializePayLogs.error('Error creating estate', {
        email: redactEmailUsername(userData.email),
        error: estateError,
      });
      return errorResponseHelper(
        'Error creating estate',
        'ESTATE_INSERTION_ERROR',
        'Error creating estate',
        estateError,
      );
    }

    /*
      Step 5. Create an estate manager record:
      - user_id,
      - estate_id
      */
    const { error: estateMgrErr } = await supabaseAdmin.from('estate_managers').insert({
      manager_id: userData.id,
      estate_id: estateData.id,
    });

    if (estateMgrErr) {
      initializePayLogs.error('Error associating estate with manager', {
        email: redactEmailUsername(userData.email),
        error: estateMgrErr,
      });
      return errorResponseHelper(
        'Error associating estate with manager',
        'ESTATE_MANAGER_CREATION_ERROR',
        'Error associating estate with manager',
        estateMgrErr,
      );
    }

    /*
      Step 6. Create payment record:
         - estate_id
         - paid_by
         - amount
         - expires_at
         - plan_id
         - purpose: estate_subscription_initial_payment
         - status: initializing
         - reference: generated unique reference
         - currency: "NGN",
         - provider: "paystack"
      */
    const expiresAt = new Date();
    if (period === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }
    const reference = generatePaymentReference();
    const paymentPurpose = 'estate_subscription_initial_payment';
    const { data: paymentData, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        estate_id: estateData.id,
        paid_by: userData.id,
        payer_email: userData.email,
        amount: amountInNaira,
        expires_at: expiresAt.toISOString(),
        plan_id: planData.id,
        purpose: paymentPurpose,
        status: 'initializing',
        reference,
        period,
        currency: 'NGN',
        provider: 'paystack',
      })
      .select('id, currency')
      .single();

    if (paymentError) {
      initializePayLogs.error('Error creating payment', {
        email: redactEmailUsername(userData.email),
        error: paymentError,
      });
      return errorResponseHelper(
        'Error creating payment',
        'PAYMENT_INSERTION_ERROR',
        'Error creating payment',
        paymentError,
      );
    }

    /*
      Step 7. Initialize Paystack transaction:
      - email
      - amount in kobo
      - reference from payment record
      - callback_url
      - metadata:
         estate_id
         payment_id
         user_id
         plan_id
         period
         currency
      */
    const callbackUrl = `${baseUrl}/api/v1/payments/callback`;
    let paystackResponse;

    try {
      paystackResponse = await initializePaystackTransactionService({
        email: userData.email,
        amount: amountInKobo,
        reference,
        callback_url: callbackUrl,
        metadata: {
          payment_id: paymentData.id,
          estate_id: estateData.id,
          user_id: userData.id,
          plan_id,
          period,
          currency: paymentData.currency,
        },
      });
    } catch (error) {
      initializePayLogs.error('Unable to initialize Paystack transaction', {
        email: redactEmailUsername(userData.email),
        user_id: userData.id,
        estate_id: estateData.id,
        payment_id: paymentData.id,
        reference,
        error,
      });

      await supabaseAdmin
        .from('payments')
        .update({
          status: 'initialization_failed',
          provider_response: {
            message: error instanceof Error ? error.message : 'Paystack initialization failed',
          },
        })
        .eq('id', paymentData.id);

      return errorResponseHelper(
        'Unable to initialize Paystack transaction',
        'PAYSTACK_INITIALIZATION_ERROR',
        'Unable to initialize Paystack transaction',
        error,
      );
    }

    /*
      Step 8. Save Paystack initialization response:
      - authorization_url
      - access_code
      - provider_response
      - initialized_at
      - status: "pending"
      */
    if (paystackResponse.data?.reference !== reference) {
      initializePayLogs.error('Paystack reference mismatch', {
        email: redactEmailUsername(userData.email),
      });

      await supabaseAdmin
        .from('payments')
        .update({
          status: 'initialization_failed',
          provider_response: {
            status: paystackResponse.status,
            message: paystackResponse.message,
            data: paystackResponse.data,
          },
        })
        .eq('id', paymentData.id);

      return errorResponseHelper(
        'Paystack reference mismatch. Please try again',
        'REFERENCE_MISMATCH',
        'Paystack reference mismatch. Please try again',
      );
    }

    const { authorization_url, access_code, reference: paystackReference } = paystackResponse.data;
    const { error: paystackError } = await supabaseAdmin
      .from('payments')
      .update({
        authorization_url,
        access_code,
        reference: paystackReference,
        initialized_at: new Date().toISOString(),
        status: 'pending',
        provider_response: {
          status: paystackResponse.status,
          message: paystackResponse.message,
          data: paystackResponse.data,
        },
      })
      .eq('id', paymentData.id);

    if (paystackError) {
      initializePayLogs.error('Error saving payment initialization data', {
        email: redactEmailUsername(userData.email),
        error: paystackError,
      });

      return errorResponseHelper(
        'Error saving payment initialization data',
        'PAYMENT_UPDATE_ERROR',
        'Error saving payment initialization data',
        paystackError,
      );
    }

    /*
      Step 9. Return to caller:
      - payment_id
      - estate_id
      - reference
      - authorization_url
      - access_code
      */

    initializePayLogs.info('Payment successfully initialized', {
      email: redactEmailUsername(userData.email),
      user_id: userData.id,
      estate_id: estateData.id,
      payment_id: paymentData.id,
      reference,
      period,
      amount: amountInNaira,
      currency: 'NGN',
    });
    return successResponseHelper('Payment successfully initialized', {
      payment_id: paymentData.id,
      estate_id: estateData.id,
      reference,
      authorization_url,
      access_code,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      initializePayLogs.error('Error validating initialize payment input', {
        error,
      });
      return errorResponseHelper(
        'Error validating initialize payment input',
        'VALIDATION_ERROR',
        'Error validating initialize payment input',
        error,
      );
    }

    initializePayLogs.error('Unexpected error while initializing payment', {
      error,
    });
    return errorResponseHelper(
      'Error while initializing payment',
      'INITIALIZE_PAYMENT_ERROR',
      'Unexpected error while initializing payment',
      error,
    );
  }
};

export default InitializeEstatesubscriptionPaymentService;
