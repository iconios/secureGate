// Get Manager Estates Service
/*
#Plan:
1. Get manager id from request (set by authenticateToken middleware)
2. Fetch the details of each estates associated with the manager from the database
3. Return the details of each estate in the response
*/

import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import logger from '../../common/winston/logger.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';

// Step 1. Get manager id from request (set by authenticateToken middleware) - This will be passed as an argument to the service function
const GetManagerEstatesService = async (managerId: string) => {
  const estateManagerLogs = logger.child({
    service: 'GetManagerEstatesService',
    requestId: randomUUID(),
  });

  try {
    // Step 2. Fetch the details of each estates associated with the manager from the database
    const { data: estates, error } = await supabaseAdmin
      .from('estate_managers')
      .select(
        `
                id,
                estate_id,
                estates (
                    id, 
                    name, 
                    location, 
                    state, 
                    number_of_households,
                    status, 
                    logo_url,
                    plan_id,
                    subscription_plans (
                        name, 
                        household_limit
                    ), 
                    payment_id,
                    payments (
                        id, 
                        expires_at, 
                        paid_at, 
                        status
                    )
                )
            `,
      )
      .eq('manager_id', managerId);

    if (error) {
      estateManagerLogs.error('Failed to fetch estates for manager', {
        managerId,
      });
      return errorResponseHelper(
        'Failed to fetch estates for manager',
        'DATABASE_ERROR',
        'Failed to fetch estates for manager',
        error,
      );
    }

    if (!estates || estates.length === 0) {
      estateManagerLogs.info('No estates found for manager', {
        managerId,
      });
      return errorResponseHelper(
        'No estates found for this manager',
        'NO_ESTATES_FOUND',
        'No estates found for this manager',
      );
    }

    const validEstates = estates.filter((item) => item.estates !== null);
    if (validEstates.length === 0) {
      estateManagerLogs.info('No valid estates found for manager', {
        managerId,
      });
      return errorResponseHelper(
        'No valid estates found for this manager',
        'NO_VALID_ESTATES_FOUND',
        'No valid estates found for this manager',
      );
    }

    const cleanEstatesList = validEstates.map((item) => {
      const estate = item.estates as any;
      return {
        id: item.id,
        estate_id: estate.id,
        estate_name: estate.name,
        estate_location: estate.location,
        estate_state: estate.state,
        estate_status: estate.status,
        estate_logo_url: estate.logo_url,
        estate_number_of_households: estate.number_of_households,
        estate_plan_id: estate.plan_id,
        estate_subscription_plan_name: estate.subscription_plans?.name,
        estate_subscription_plan_household_limit: estate.subscription_plans?.household_limit,
        estate_payment_id: estate.payment_id,
        estate_payment_expires_at: estate.payments?.expires_at,
        estate_payment_paid_at: estate.payments?.paid_at,
        estate_payment_status: estate.payments?.status,
      };
    });

    // Step 3. Return the details of each estate in the response
    return successResponseHelper('Estates fetched successfully', cleanEstatesList);
  } catch (error) {
    estateManagerLogs.error('Unexpected layout exception crash fetching estates', {
      managerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponseHelper(
      'Error fetching estates for manager',
      'ESTATES_FETCH_ERROR',
      'Error fetching estates for manager',
      error,
    );
  }
};

export default GetManagerEstatesService;
