// Fetch Households By Estate Controller
/*
#Plan:
1. Accept and validate the fetch request data
2. Pass the data to fetchHouseholdsByEstateService
3. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { fetchHouseholdsByEstateService } from './fetch_households_by_estate_service.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const fetchHouseholdsByEstateController = async (req: Request, res: Response) => {
  const householdLogs = logger.child({
    service: 'fetchHouseholdsByEstateController',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the fetch request data
    const userId = req.userId;
    if (!userId) {
      householdLogs.warn('User id required');
      return res
        .status(401)
        .json(
          errorResponseHelper(
            'User id required',
            'USER_ID_REQUIRED',
            `${householdLogs.defaultMeta?.requestId}`,
          ),
        );
    }

    const { estateId, page, pageSize, searchTerm } = req.query;
    if (!estateId || typeof estateId !== 'string') {
      householdLogs.warn('Estate id required or format invalid', {
        userId: userId,
      });
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Estate id required or format invalid',
            'ESTATE_ID_OR_FORMAT_INVALID',
            `${householdLogs.defaultMeta?.requestId}`,
          ),
        );
    }

    if (searchTerm && typeof searchTerm !== 'string') {
      householdLogs.warn('Search term format invalid', {
        userId: userId,
        estateId: estateId,
      });
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Search term format invalid',
            'SEARCH_TERM_FORMAT_INVALID',
            `${householdLogs.defaultMeta?.requestId}`,
          ),
        );
    }

    // 2. Pass the data to fetchHouseholdsByEstateService
    const result = await fetchHouseholdsByEstateService({
      userId,
      estateId,
      page,
      pageSize,
      searchTerm,
    });

    // 3. Send the appropriate response to the caller/client
    if (!result.success) {
      switch (result.error?.code) {
        case 'ACCESS_DENIED':
          return res.status(403).json(result);
        case 'VALIDATION_ERROR':
          return res.status(400).json(result);
        default:
          return res.status(500).json(result);
      }
    }

    return res.status(200).json(result);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Internal Server Error';
    householdLogs.error('Internal server error', {
      message: errMessage,
      error,
    });
    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Internal server error',
          'SERVER_ERROR',
          `${householdLogs.defaultMeta?.requestId}`,
          error,
        ),
      );
  }
};
