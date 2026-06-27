// Forgot Password Manager Controller
/*
#Plan:
1. Accept and validate the resend verification request body
2. Pass the validated data to the ForgotPasswordManagerService
3. Handle the response from the service and send appropriate HTTP response
4. Log the login attempt and any errors that occur
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import ForgotPasswordManagerService from './forgot_password.manager.service.js';

const ForgotPasswordManagerController = async (req: Request, res: Response) => {
  const managerLogs = logger.child({
    service: 'ForgotPasswordManagerController',
    requestId: randomUUID(),
  });

  try {
    // Step 1. Accept and validate the resend verification request body
    const email = String(req.body.email).trim().toLowerCase();

    if (!email) {
      managerLogs.warn('Email field is required for the request');

      return res
        .status(400)
        .json(
          errorResponseHelper('Email field is required', 'EMAIL_REQUIRED', 'Email is required'),
        );
    }

    // Step 2. Pass the validated data to the ForgotPasswordManagerService
    const result = await ForgotPasswordManagerService({ email });

    // Step 3. Handle the response from the service and send appropriate HTTP response
    if (!result.success) {
      switch (result.error?.code) {
        case 'COOLDOWN_ACTIVE':
          return res.status(429).json(result);
        case 'BAD_REQUEST':
          return res.status(400).json(result);
        default:
          return res.status(500).json(result);
      }
    }

    return res.status(201).json(result);
  } catch (error) {
    managerLogs.error('Error in ForgotPasswordManagerController', {
      error: error instanceof Error ? error.message : error,
    });

    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Internal server error',
          'INTERNAL_SERVER_ERROR',
          'An unexpected error occurred while processing the forgot password request',
        ),
      );
  }
};

export default ForgotPasswordManagerController;
