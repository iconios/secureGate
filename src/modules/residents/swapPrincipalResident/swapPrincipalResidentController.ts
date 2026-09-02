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
import { swapPrincipalResidentService } from './swapPrincipalResidentService.js';
import { AppError } from '../../../common/errors/appError.js';

export const swapPrincipalResidentController = async (req: Request, res: Response) => {
  const residentLogs = logger.child({
    service: 'swapPrincipalResidentController',
    requestId: randomUUID(),
  });

  // 1. Accept and validate the fetch request data
  const userId = req.userId;
  if (!userId) {
    residentLogs.warn('User id is required');

    throw new AppError(400, 'USER_ID_REQUIRED', 'User id is required', 'User id is required');
  }

  const { householdId, estateId } = req.params;
  if (!householdId || typeof householdId !== 'string') {
    residentLogs.warn('Household id is required');

    throw new AppError(
      400,
      'HOUSEHOLD_ID_REQUIRED',
      'Household id is required',
      'Household id is required',
    );
  }

  if (!estateId || typeof estateId !== 'string') {
    residentLogs.warn('Estate id is required');

    throw new AppError(400, 'ESTATE_ID_REQUIRED', 'Estate id is required', 'Estate id is required');
  }

  const { oldPrincipalId, newPrincipalId } = req.body;
  if (!oldPrincipalId || typeof oldPrincipalId !== 'string') {
    residentLogs.warn('Old principal id is required');

    throw new AppError(
      400,
      'OLD_PRINCIPAL_ID_REQUIRED',
      'Old principal id is required',
      'Old principal id is required',
    );
  }

  if (!newPrincipalId || typeof newPrincipalId !== 'string') {
    residentLogs.warn('New Principal id is required');

    throw new AppError(
      400,
      'NEW_PRINCIPAL_ID_REQUIRED',
      'New Principal id is required',
      'New Principal id is required',
    );
  }

  // 2. Pass the data to swapPrincipalResidentService
  const result = await swapPrincipalResidentService(userId, {
    newPrincipalId,
    oldPrincipalId,
    householdId,
    estateId,
  });

  return res.status(200).json(result);
};
