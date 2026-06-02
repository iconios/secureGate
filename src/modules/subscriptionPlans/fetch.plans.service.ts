// Fetch Subscription Plans Service
/*
#Plan:
1. Fetch the subscription plans
2. Send response to the caller
*/

import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import logger from '../../common/winston/logger.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';

const FetchSubscriptionPlansService = async () => {
  const isDev = process.env.NODE_ENV === 'development';

  const plansLogs = logger.child({
    service: 'FetchSubscriptionPlansService',
    requestId: randomUUID(),
  });

  try {
    // Step 1. Fetch the subscription plans
    const { data: plansData, error: plansError } = await supabaseAdmin
      .from('subscription_plans')
      .select(
        'id, description, name, household_limit, status, price_per_period, monthly_fee, yearly_fee',
      )
      .eq('status', 'active')
      .order('monthly_fee', { ascending: true });

    if (plansError) {
      plansLogs.error('Error fetching subscription plans', {
        error: plansError,
      });
      return errorResponseHelper(
        'Error fetching subscription plans',
        'DATABASE_ERROR',
        'Error fetching subscription plans',
        plansError,
      );
    }

    // Step 2. Send response to the caller
    plansLogs.info('Subscription plans successfully fetched');
    return successResponseHelper('Subscription plans successfully fetched', {
      plansData,
    });
  } catch (error) {
    if (isDev) {
      console.error('FetchSubscriptionPlansService error:', error);
    }

    plansLogs.error('Internal server error', {
      error,
    });
    return errorResponseHelper(
      'Internal server error',
      'INTERNAL_ERROR',
      'Unexpected error while fetching subscription plans',
      error,
    );
  }
};

export default FetchSubscriptionPlansService;
