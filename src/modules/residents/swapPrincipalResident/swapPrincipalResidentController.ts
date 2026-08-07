// Swap Principal Resident Controller
/*
#Plan:
1. Accept and validate the fetch request data
2. Pass the data to swapPrincipalResidentService
3. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { swapPrincipalResidentService } from './swapPrincipalResidentService.js';

export const swapPrincipalResidentController = async (req: Request, res: Response) => {
  const residentLogs = logger.child({
    service: 'swapPrincipalResidentController',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the fetch request data
    const userId = req.userId;
    if (!userId) {
      residentLogs.warn('User id is required');
      return res
        .status(400)
        .json(
          errorResponseHelper('User id is required', 'USER_ID_REQUIRED', 'User id is required'),
        );
    }

    const { householdId, estateId } = req.params;
    if (!householdId || typeof householdId !== 'string') {
      residentLogs.warn('Household id is required');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Household id is required',
            'HOUSEHOLD_ID_REQUIRED',
            'Household id is required',
          ),
        );
    }

    if (!estateId || typeof estateId !== 'string') {
      residentLogs.warn('Estate id is required');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Estate id is required',
            'ESTATE_ID_REQUIRED',
            'Estate id is required',
          ),
        );
    }

    const { oldPrincipalId, newPrincipalId } = req.body;
    if (!oldPrincipalId || typeof oldPrincipalId !== 'string') {
      residentLogs.warn('Old principal id is required');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Old principal id is required',
            'OLD_PRINCIPAL_ID_REQUIRED',
            'Old principal id is required',
          ),
        );
    }

    if (!newPrincipalId || typeof newPrincipalId !== 'string') {
      residentLogs.warn('New Principal id is required');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'New Principal id is required',
            'NEW_PRINCIPAL_ID_REQUIRED',
            'New Principal id is required',
          ),
        );
    }

    // 2. Pass the data to swapPrincipalResidentService
    const result = await swapPrincipalResidentService(userId, {
      newPrincipalId,
      oldPrincipalId,
      householdId,
      estateId,
    });

    if (!result.success) {
      switch (result.error?.code) {
        case 'USER_ID_REQUIRED':
          return res.status(400).json(result);
        case 'ACCESS_DENIED':
        case 'HOUSEHOLD_ESTATE_MISMATCH':
        case 'VALIDATION_ERROR':
          return res.status(403).json(result);
        default:
          return res.status(500).json(result);
      }
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
