// Delete Household Controller
/*
#Plan:
1. Accept and validate the data
2. Pass the data to deleteHouseholdService
3. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { deleteHouseholdService } from './deleteHouseholdService.js';

export const deleteHouseholdController = async (req: Request, res: Response) => {
  const householdLogs = logger.child({
    service: 'deleteHouseholdController',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the data
    const userId = req.userId;
    if (!userId) {
      householdLogs.warn('Unauthorized: User ID is missing');
      return res
        .status(401)
        .json(
          errorResponseHelper(
            'Unauthorized: User ID is missing',
            'UNAUTHORIZED',
            'User ID is required for this operation',
          ),
        );
    }

    const { householdId, estateId } = req.params;
    if (!householdId || typeof householdId !== 'string') {
      householdLogs.warn('Household ID is missing');
      return res
        .status(401)
        .json(
          errorResponseHelper(
            'Household ID is missing',
            'HOUSEHOLD_ID_REQUIRED',
            'Household ID is required for this operation',
          ),
        );
    }

    if (!estateId || typeof estateId !== 'string') {
      householdLogs.warn('Estate ID is missing');
      return res
        .status(401)
        .json(
          errorResponseHelper(
            'Estate ID is missing',
            'ESTATE_ID_REQUIRED',
            'Estate ID is required for this operation',
          ),
        );
    }

    // 2. Pass the data to deleteHouseholdService
    const result = await deleteHouseholdService({ householdId, estateId }, userId);

    // 3. Send the appropriate response to the caller/client
    if (!result.success) {
      switch (result.error?.code) {
        case 'HOUSEHOLD_NOT_FOUND':
          return res.status(404).json(result);
        case 'ACCESS_DENIED':
          return res.status(401).json(result);
        default:
          return res.status(500).json(result);
      }
    }

    return res.status(200).json(result);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Internal Server Error';
    householdLogs.warn('Internal server error', {
      message: errMessage,
      error,
    });
    return res
      .status(500)
      .json(errorResponseHelper('Internal server error', 'SERVER_ERROR', errMessage, error));
  }
};
