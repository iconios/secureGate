// Verify Manager Controller
/*
Plan:
1. Accept and validate the verification request (e.g., email, token).
2. Pass the validated data to the VerifyManagerService
3. Send the response back to the client
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../utils/errorResponseHelper';
import VerifyManagerService from './verify.managers.service';
import logger from '../../common/winston/logger';
import { randomUUID } from 'crypto';

const VerifyManagerController = async (req: Request, res: Response) => {
  const managerLogs = logger.child({
    service: 'verifyManagerController',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the verification request (e.g., email, token).
    const { email, token } = req.body;

    if (!email || !token) {
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Email and token are required',
            'MISSING_FIELDS',
            'Email and token must be provided',
          ),
        );
    }

    // 2. Pass the validated data to the VerifyManagerService
    const result = await VerifyManagerService({ email, token });

    // 3. Send the response back to the client
    if (!result?.success) {
      switch (result?.error?.code) {
        case 'VERIFICATION_ERROR':
          return res.status(400).json(result);
        default:
          return res.status(500).json(result);
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    managerLogs.error('Error in VerifyManagerController', {
      error: error instanceof Error ? error.message : error,
    });

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

export default VerifyManagerController;
