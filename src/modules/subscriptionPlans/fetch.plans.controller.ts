// Fetch Subscription Plans Controller
/*
#Plan:
1. Pass the request to FetchSubscriptionPlansService
2. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import FetchSubscriptionPlansService from './fetch.plans.service.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';

const FetchSubscriptionPlansController = async (req: Request, res: Response) => {
  const isDev = process.env.NODE_ENV === 'development';

  const plansLogs = logger.child({
    service: 'FetchSubscriptionPlansController',
    requestId: randomUUID(),
  });

  try {
    // Step 1. Pass the request to FetchSubscriptionPlansService
    const result = await FetchSubscriptionPlansService();

    // Step 2. Send the appropriate response to the caller/client
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    if (isDev) {
      console.error('Error in FetchSubscriptionPlansController:', error);
    }

    plansLogs.error('Error in FetchSubscriptionPlansController', {
      error: error instanceof Error ? error.message : error,
    });

    return res
      .status(500)
      .json(
        errorResponseHelper(
          'An unexpected error occurred',
          'INTERNAL_SERVER_ERROR',
          'Failed to fetch subscription plans',
        ),
      );
  }
};

export default FetchSubscriptionPlansController;
