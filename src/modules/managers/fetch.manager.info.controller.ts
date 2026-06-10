// Fetch Manager Info Controller
/*
#Plan:
1. Accept and validate the request query token
2. Pass the validated data to the FetchManagerInfoService
3. Send the response back to the client
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import FetchManagerInfoService from './fetch.manager.info.service.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';

const FetchManagerInfoController = async (req: Request, res: Response) => {
  const managerLogs = logger.child({
    service: 'FetchManagerInfoController',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the request query token
    const token = req.token;

    if (typeof token !== 'string') {
      managerLogs.warn('Token rquired');
      return res
        .status(400)
        .json(errorResponseHelper('Token rquired,', 'TOKEN_REQUIRED', 'Token required'));
    }

    // 2. Pass the validated data to the FetchManagerInfoService
    const result = await FetchManagerInfoService(token);

    if (!result.success) {
      if (
        result.error?.code === 'EMPTY_JWT_SECRET' ||
        result.error?.code === 'TOKEN_NOT_DECODED' ||
        result.error?.code === 'EMPTY_TOKEN'
      ) {
        return res.status(404).json(result);
      } else return res.status(500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    managerLogs.error('Internal Server Error', {
      error,
    });
    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Internal Server Error',
          'INTERNAL_SERVER_ERROR',
          'An unexpected error occurred',
          error,
        ),
      );
  }
};

export default FetchManagerInfoController;
