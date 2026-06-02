// src/modules/managers/create.manager.controller.ts
/*
Plan:
1. Accept and validate the request body (full_name, email, phone, password)
2. Pass the validated data to the CreateManagerService
3. Send the response back to the client
*/

import { Request, Response } from 'express';
import CreateManagerService from './create.managers.service.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';

const CreateManagerController = async (req: Request, res: Response) => {
  const managerLogs = logger.child({
    service: 'createManagerController',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the request body (full_name, email, phone, password)
    const { full_name, email, phone, password } = req.body;

    if (!full_name || !email || !phone || !password) {
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'All fields are required',
            'MISSING_FIELDS',
            'All required fields must be provided',
          ),
        );
    }

    // 2. Pass the validated data to the CreateManagerService
    const result = await CreateManagerService({ full_name, email, phone, password });

    // 3. Send the response back to the client
    if (!result.success) {
      switch (result.error?.code) {
        case 'EMAIL_ALREADY_EXISTS':
        case 'EMAIL_IN_USE':
          return res.status(409).json(result);
        case 'VALIDATION_ERROR':
          return res.status(400).json(result);
        case 'TOO_MANY_ATTEMPTS':
          return res.status(429).json(result);
        default:
          return res.status(500).json(result);
      }
    }

    return res.status(201).json(result);
  } catch (error) {
    managerLogs.error('Error in CreateManagerController', {
      error: error instanceof Error ? error.message : error,
    });
    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Internal Server Error',
          'INTERNAL_SERVER_ERROR',
          'An unexpected error occurred',
        ),
      );
  }
};

export default CreateManagerController;
