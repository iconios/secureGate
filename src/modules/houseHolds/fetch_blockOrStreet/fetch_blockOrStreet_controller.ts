// Fetch Block or Street Controller
/*
#Plan:
1. Accept and validate the fetch request data
2. Pass the data to FetchBlockOrStreetService
3. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { FetchBlockOrStreetService } from './fetch_blockOrStreet_service.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const FetchBlockOrStreetController = async (req: Request, res: Response) => {
  const householdLogs = logger.child({
    service: 'FetchBlockOrStreetController',
    requestId: randomUUID(),
  });
  try {
    // 1. Accept and validate the fetch request data
    const userId = req.userId;
    if (!userId) {
      householdLogs.warn('Manager id required');
      return errorResponseHelper(
        'Manager id required',
        'MANAGER_ID_REQUIRED',
        'Manager id required',
      );
    }

    const { estateId } = req.query;
    if (!estateId || typeof estateId !== 'string') {
      householdLogs.warn('Estate id required');
      return errorResponseHelper('Estate id required', 'ESTATE_ID_REQUIRED', 'Estate id required');
    }

    // 2. Pass the data to FetchBlockOrStreetService
    const result = await FetchBlockOrStreetService(userId, estateId);

    if (!result.success) {
      switch (result.error?.code) {
        case 'MANAGER_DATA_REQUIRED':
        case 'ESTATE_DATA_REQUIRED':
          return res.status(400).json(result);
        case 'ESTATE_ACCESS_DENIED':
          return res.status(403).json(result);
        default:
          return res.status(500).json(result);
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Internal Server Error';
    householdLogs.error('Internal server error', {
      message: errMessage,
      error,
    });
    return res
      .status(500)
      .json(errorResponseHelper('Internal server error', 'SERVER_ERROR', errMessage, error));
  }
};
