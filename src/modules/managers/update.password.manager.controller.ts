// Update Password Manager Controller
/*
#Plan:
1. Accept and validate the password update data
2. Pass the data to UpdatePasswordManagerService
3. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import UpdatePasswordManagerService from './update.password.manager.service.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';

const UpdatePasswordManagerController = async (req: Request, res: Response) => {
  const managerLogs = logger.child({
    service: 'UpdatePasswordManagerController',
    requestId: randomUUID(),
  });

  try {
    // Step 1. Accept and validate the password update data
    const { request_id, token } = req.query;
    const { password } = req.body;

    if (!request_id || !token || !password) {
      managerLogs.warn('Missing required fields');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'All fields are required',
            'MISSING_FIELDS',
            'All fields are required',
          ),
        );
    }

    if (
      typeof password !== 'string' ||
      typeof request_id !== 'string' ||
      typeof token !== 'string'
    ) {
      managerLogs.warn('Invalid formats received for required fields');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Invalid formats for required fields',
            'INVALID_FORMATS',
            'Invalid formats for required fields',
          ),
        );
    }

    // Step 2. Pass the data to UpdatePasswordManagerService
    const result = await UpdatePasswordManagerService({ request_id, password, token });

    // Step 3. Send the appropriate response to the caller/client
    if (!result.success) {
      switch (result.error?.code) {
        case 'INVALID_TOKEN':
        case 'INVALID_OR_EXPIRED_TOKEN':
        case 'BAD_REQUEST':
          return res.status(400).json(result);
        default:
          return res.status(500).json(result);
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    managerLogs.error('Error in UpdatePasswordManagerController', {
      error: error instanceof Error ? error.message : error,
    });

    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Internal server error',
          'INTERNAL_SERVER_ERROR',
          'An unexpected error occurred while processing the password update request',
        ),
      );
  }
};

export default UpdatePasswordManagerController;
