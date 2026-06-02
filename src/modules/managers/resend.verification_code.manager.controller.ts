// Resend Verification Code Manager Controller
/*
#Plan:
1. Accept and validate the resend verification request body
2. Pass the validated data to the ResendVerificationCodeManagerService
3. Handle the response from the service and send appropriate HTTP response
4. Log the login attempt and any errors that occur
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import ResendVerificationCodeManagerService from './resend.verification_code.managers.service.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';

const ResendVerificationCodeManagerController = async (req: Request, res: Response) => {
  const managerLogs = logger.child({
    service: 'ResendVerificationCodeManagerController',
    requestId: randomUUID(),
  });
  try {
    // Step 1. Accept and validate the resend verification request body
    const email = String(req.body.email).trim().toLowerCase();

    if (!email) {
      managerLogs.info('Email field is required for the request');

      return res
        .status(400)
        .json(
          errorResponseHelper('Email field is required', 'EMAIL_REQUIRED', 'Email is required'),
        );
    }

    // Step 2. Pass the validated data to the ResendVerificationCodeManagerService
    const result = await ResendVerificationCodeManagerService({ email });

    // Step 3. Handle the response from the service and send appropriate HTTP response
    if (!result.success) {
      switch (result.error?.code) {
        case 'USER_NOT_FOUND':
          return res.status(404).json(result);
        case 'MAX_ATTEMPTS_REACHED':
        case 'COOLDOWN_ACTIVE':
          return res.status(429).json(result);
        case 'BAD_REQUEST':
          return res.status(400).json(result);
        default:
          return res.status(500).json(result);
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    managerLogs.error('Error in ResendVerificationCodeManagerController', {
      error: error instanceof Error ? error.message : error,
    });

    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Internal server error',
          'INTERNAL_SERVER_ERROR',
          'An unexpected error occurred while processing the resend verification code request',
        ),
      );
  }
};

export default ResendVerificationCodeManagerController;
