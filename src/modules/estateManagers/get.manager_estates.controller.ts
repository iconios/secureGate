// Get Manager's Estates Controller
/*
#Plan:
1. Get manager id from request (set by authenticateToken middleware)
2. Pass the manager id to the GetManagerEstatesService
3. Return the details of each estate in the response
*/

import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { Response, Request } from 'express';
import GetManagerEstatesService from './get.manager_estates.service.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';

const GetManagerEstatesController = async (req: Request, res: Response) => {
  const estateManagerLogs = logger.child({
    service: 'GetManagerEstatesController',
    requestId: randomUUID(),
  });

  // Step 1. Get manager id from request (set by authenticateToken middleware)
  const managerId = req.userId;

  if (!managerId) {
    estateManagerLogs.error('Manager ID not found in request');
    return res
      .status(400)
      .json(
        errorResponseHelper(
          'Manager ID not found in request',
          'MANAGER_ID_MISSING',
          'Manager ID not found in request',
        ),
      );
  }

  // Step 2. Pass the manager id to the GetManagerEstatesService
  try {
    const result = await GetManagerEstatesService(managerId);

    if (!result.success) {
      const errorCode = result.error?.code;
      if (errorCode === 'DATABASE_ERROR') {
        return res.status(500).json(result);
      }
      if (errorCode === 'NO_ESTATES_FOUND' || errorCode === 'NO_VALID_ESTATES_FOUND') {
        return res.status(404).json(result);
      }
      return res.status(400).json(result);
    }

    // Step 3. Return the details of each estate in the response
    return res.status(200).json(result);
  } catch (error) {
    estateManagerLogs.error('An error occurred while fetching manager estates', { error });
    if (!res.headersSent) {
      return res
        .status(500)
        .json(
          errorResponseHelper(
            'An error occurred while fetching manager estates',
            'INTERNAL_SERVER_ERROR',
            'An error occurred while fetching manager estates',
            error,
          ),
        );
    }
  }
};

export default GetManagerEstatesController;
