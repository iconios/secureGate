// Get Manager Estates Service
/*
#Plan:
1. Get manager id from request (set by authenticateToken middleware)
2. Fetch the details of each estates associated with the manager from the database
3. Return the details of each estate in the response
*/

import { randomUUID } from 'crypto';
import logger from '../../common/winston/logger.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { ZodError } from 'zod';
import db from '../../db/index.js';
import { estateManagers } from '../../db/schema/estateManagers.js';
import { eq } from 'drizzle-orm';
import { estates } from '../../db/schema/estates.js';
import { subscriptionPlans } from '../../db/schema/subscriptionPlans.js';
import { payments } from '../../db/schema/payments.js';

// Step 1. Get manager id from request (set by authenticateToken middleware) - This will be passed as an argument to the service function
const GetManagerEstatesService = async (managerId: string) => {
  const estateManagerLogs = logger.child({
    service: 'GetManagerEstatesService',
    requestId: randomUUID(),
  });

  try {
    // Step 2. Fetch the details of each estates associated with the manager from the database
    const managerEstates = await db
      .select({
        estate_manager_id: estateManagers.id,
        estate_id: estates.id,
        estate_name: estates.name,
        estate_location: estates.location,
        estate_state: estates.state,
        estate_status: estates.status,
        estate_logo_url: estates.logoUrl,
        estate_plan_id: estates.planId,
        estate_number_of_households: estates.numberOfHouseholds,
        estate_subscription_plan_name: subscriptionPlans.name,
        estate_subscription_plan_household_limit: subscriptionPlans.householdLimit,
        estate_payment_id: estates.paymentId,
        estate_payment_expires_at: payments.expiresAt,
        estate_payment_paid_at: payments.paidAt,
        estate_payment_status: payments.status,
      })
      .from(estateManagers)
      .where(eq(estateManagers.managerId, managerId))
      .innerJoin(estates, eq(estates.id, estateManagers.estateId))
      .innerJoin(subscriptionPlans, eq(estates.planId, subscriptionPlans.id))
      .innerJoin(payments, eq(payments.id, estates.paymentId));

    if (!managerEstates || managerEstates.length === 0) {
      estateManagerLogs.info('No estates found for manager', {
        manager_id: managerId,
      });
      return successResponseHelper('No estates found for this manager', managerEstates);
    }

    const validEstates = managerEstates.filter(
      (item) => item.estate_payment_status !== null || item.estate_payment_status !== undefined,
    );
    if (validEstates.length === 0) {
      estateManagerLogs.info('No valid estates found for manager', {
        manager_id: managerId,
      });
      return successResponseHelper('No valid estates found for this manager', validEstates);
    }

    const cleanEstatesList = validEstates.map((item) => {
      return {
        id: item.estate_manager_id,
        estate_id: item.estate_id,
        estate_name: item.estate_name,
        estate_location: item.estate_location,
        estate_state: item.estate_state,
        estate_status: item.estate_status,
        estate_logo_url: item.estate_logo_url,
        estate_number_of_households: item.estate_number_of_households,
        estate_plan_id: item.estate_plan_id,
        estate_subscription_plan_name: item.estate_subscription_plan_name,
        estate_subscription_plan_household_limit: item.estate_subscription_plan_household_limit,
        estate_payment_id: item.estate_payment_id,
        estate_payment_expires_at: item.estate_payment_expires_at,
        estate_payment_paid_at: item.estate_payment_paid_at,
        estate_payment_status: item.estate_payment_status,
      };
    });

    // Step 3. Return the details of each estate in the response
    return successResponseHelper('Estates fetched successfully', cleanEstatesList);
  } catch (error) {
    estateManagerLogs.error('Unexpected layout exception crash fetching estates', {
      manager_id: managerId,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof ZodError) {
      return errorResponseHelper(
        'Data validation failed for estates list',
        'VALIDATION_ERROR',
        'The databse returned data that does not match the expected application format',
        error.issues,
      );
    }

    return errorResponseHelper(
      'Error fetching estates for manager',
      'ESTATES_FETCH_ERROR',
      'Error fetching estates for manager',
      error,
    );
  }
};

export default GetManagerEstatesService;
