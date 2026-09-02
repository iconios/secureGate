// Get Residents By Estate Controller
/*
#Plan:
1. Accept and validate the fetch request data
2. Pass the data to getResidentsByEstateService
3. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { AppError } from '../../../common/errors/appError.js';
import { getResidentsByEstateService } from './getResidentsByEstateService.js';

export const getResidentsByEstateController = async (req: Request, res: Response) => {
  const residentLogs = logger.child({
    service: 'getResidentsByEstateController',
    requestId: randomUUID(),
  });

  // 1. Accept and validate the fetch request data
  const userId = req.userId;
  if (!userId) {
    residentLogs.warn('User id required');
    throw new AppError(401, 'USER_ID_REQUIRED', 'User id required', 'User id required');
  }

  const { estateId } = req.params;
  const { page, pageSize, searchTerm } = req.query;

  if (!estateId || typeof estateId !== 'string') {
    residentLogs.warn('Estate id required or format invalid', {
      userId: userId,
    });
    throw new AppError(
      400,
      'ESTATE_ID_OR_FORMAT_INVALID',
      'Estate id required or format invalid',
      'Estate id required or format invalid',
    );
  }

  if (searchTerm && typeof searchTerm !== 'string') {
    residentLogs.warn('Search term format invalid', {
      userId: userId,
      estateId: estateId,
    });
    throw new AppError(
      400,
      'SEARCH_TERM_FORMAT_INVALID',
      'Search term format invalid',
      'Search term format invalid',
    );
  }

  // 2. Pass the data to getResidentsByEstateService
  const result = await getResidentsByEstateService({
    userId,
    estateId,
    page,
    pageSize,
    searchTerm,
  });

  // 3. Send the appropriate response to the caller/client
  return res.status(200).json(result);
};
