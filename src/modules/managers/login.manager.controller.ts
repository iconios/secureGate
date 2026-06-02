// Login Manager Controller
/*
Plan:
1. Accept and validate the login data from the request body
2. Pass the validated data to the LoginManagerService
3. Handle the response from the service and send appropriate HTTP response
4. Log the login attempt and any errors that occur
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import LoginManagerService from './login.manager.service.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';

const LoginManagerController = async (req: Request, res: Response) => {
  const isDev = process.env.NODE_ENV === 'development';
  const managerLogs = logger.child({
    service: 'loginManagerController',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the login data from the request body
    const { email, password } = req.body;

    if (!email || !password) {
      managerLogs.error('Email and password are required', { email: email ?? null });

      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Email and password are required',
            'BAD_REQUEST',
            'Invalid input data provided',
          ),
        );
    }

    // 2. Pass the validated data to the LoginManagerService
    const loginResult = await LoginManagerService({ email, password });

    // 3. Handle the response from the service and send appropriate HTTP response
    if (!loginResult.success) {
      switch (loginResult.error?.code) {
        case 'INVALID_CREDENTIALS':
          return res.status(401).json(loginResult);
        case 'BAD_REQUEST':
          return res.status(400).json(loginResult);
        default:
          return res.status(500).json(loginResult);
      }
    }

    return res.status(200).json(loginResult);
  } catch (error) {
    if (isDev) {
      console.error('Error in LoginManagerController:', error);
    }

    managerLogs.error('Error in LoginManagerController', {
      error: error instanceof Error ? error.message : error,
    });

    return res
      .status(500)
      .json(
        errorResponseHelper(
          'An unexpected error occurred',
          'INTERNAL_SERVER_ERROR',
          'Failed to process login request',
        ),
      );
  }
};

export default LoginManagerController;
