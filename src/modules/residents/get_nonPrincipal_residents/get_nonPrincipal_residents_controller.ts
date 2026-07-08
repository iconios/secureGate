// Get All Non-Principal Residents By Estate Controller
/*
#Plan:
1. Accept and validate the fetch request data
2. Pass the data to getAllNonPrincipalResidentsByEstateService
3. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { getAllNonPrincipalResidentsByEstateService } from './get_nonPrincipal_residents_service.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const getAllNonPrincipalResidentsByEstateController = async (
  req: Request,
  res: Response,
) => {
  const residentLogs = logger.child({
    service: 'getAllNonPrincipalResidentsByEstateController',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the fetch request data
    const userId = req.userId;
    if (!userId) {
      residentLogs.warn('User id required');
      return res
        .status(400)
        .json(errorResponseHelper('User id required', 'USER_ID_REQUIRED', 'User id required'));
    }

    const estateId = req.body.estateId;
    if (!estateId || typeof estateId !== 'string') {
      residentLogs.warn('Estate id missing or format invalid', {
        userId,
      });
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Estate id missing or format invalid',
            'ESTATE_ID_MISSING_OR_FORMAT_INVALID',
            'Estate id missing or format invalid',
          ),
        );
    }
    const searchTerm = req.body.searchTerm;

    // 2. Pass the data to getAllNonPrincipalResidentsByEstateService
    const result = await getAllNonPrincipalResidentsByEstateService({
      userId,
      estateId,
      searchTerm,
    });

    // 3. Send the appropriate response to the caller/client
    if (!result.success) {
      if (result.error?.code === 'ACCESS_DENIED') {
        return res.status(403).json(result);
      } else return res.status(500).json(result);
    }

    return res.status(200).json(result);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Internal Server Error';
    residentLogs.error('Internal server error', {
      message: errMessage,
      error,
    });
    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Internal server error',
          'SERVER_ERROR',
          'Internal server error',
          error,
        ),
      );
  }
};
