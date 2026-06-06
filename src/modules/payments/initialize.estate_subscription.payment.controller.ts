// Initialize Estate Subscription Payment Controller
/*
#Plan:
1. Accept and validate the payment request data.
2. Pass the validated data to the InitializeEstatesubscriptionPaymentService.
3. Send the response back to the client
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import InitializeEstatesubscriptionPaymentService from './initialize.estate_subscription.payment.service.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';

const InitializeEstateSubscriptionPaymentController = async (req: Request, res: Response) => {
  const initializePayLogs = logger.child({
    service: 'InitializeEstateSubscriptionPaymentController',
    requestId: randomUUID(),
  });

  try {
    // Step 1. Accept and validate the payment request data.
    const user_id = req.userId;
    const { name, location, state, logo_url, plan_id, period } = req.body;

    if (!user_id) {
      initializePayLogs.warn('User id is missing. Please make available');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'User id is missing. Please make available',
            'USER_ID_NOT_FOUND',
            'User id is missing. Please make available',
          ),
        );
    }

    if (!name || !location || !state || !logo_url || !plan_id || !period) {
      initializePayLogs.warn('Required parameters are missing. Please make them available');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Required parameters are missing. Please make them available',
            'PARAMETERS_NOT_FOUND',
            'Required parameters are missing. Please make them available',
          ),
        );
    }

    // Step 2. Pass the validated data to the InitializeEstatesubscriptionPaymentService.
    const result = await InitializeEstatesubscriptionPaymentService({
      user_id,
      name,
      location,
      state,
      logo_url,
      plan_id,
      period,
    });

    // Step 3. Send the response back to the client
    if (!result.success) {
      switch (result.error?.code) {
        case 'MANAGER_NOT_FOUND':
        case 'PLAN_NOT_FOUND':
          return res.status(404).json(result);
        case 'REFERENCE_MISMATCH':
          return res.status(400).json(result);
        default:
          return res.status(500).json(result);
      }
    }

    return res.status(201).json(result);
  } catch (error) {
    initializePayLogs.warn(
      'An unexpected error occurred while processing the verification request',
      {
        error,
      },
    );

    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Internal server error',
          'INTERNAL_SERVER_ERROR',
          'An unexpected error occurred while processing the verification request',
        ),
      );
  }
};

export default InitializeEstateSubscriptionPaymentController;
