// Get Estate Database Status Controller
/*
#Plan:
1. Accept and validate the request data.
2. Pass the validated data to the GetEstateDatabaseStatusService.
3. Send the response back to the client
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { GetEstateDatabaseStatusService } from './get.estate_db_status.service.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const GetEstateDatabaseStatusController = async (req: Request, res: Response) => {
  const estateLogs = logger.child({
    service: 'GetEstateDatabaseStatusController',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the request data.
    const user_id = req.userId;
    if (!user_id) {
      estateLogs.warn('User identity required');
      return res
        .status(401)
        .json(
          errorResponseHelper('User identity required', 'USER_NOT_FOUND', 'User identity required'),
        );
    }

    const { reference } = req.query;
    if (!reference || typeof reference !== 'string') {
      estateLogs.warn('Reference data is missing or format invalid', {
        user_id: user_id,
      });
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Reference data is missing or format invalid',
            'REFERENCE_NOT_FOUND_OR_INVALID',
            'Reference data is missing or format invalid',
          ),
        );
    }

    // 2. Pass the validated data to the GetEstateDatabaseStatusService.
    const result = await GetEstateDatabaseStatusService(reference, user_id);

    // 3. Send the response back to the client
    if (!result.success) {
      if (
        result.error?.code === 'REFERENCE_REQUIRED' ||
        result.error?.code === 'USER_IDENTITY_REQUIRED'
      ) {
        return res.status(400).json(result);
      } else return res.status(500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    estateLogs.error(errorMessage, {
      error: error,
    });
    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Unknown server error',
          'UNKNOWN_SERVER_ERROR',
          'Unknown server error',
          error,
        ),
      );
  }
};
