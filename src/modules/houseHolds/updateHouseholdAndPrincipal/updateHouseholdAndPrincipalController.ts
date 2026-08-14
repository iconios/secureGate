// Update Household And Principal Details Controller
/*
#Plan:
1. Accept and validate the fetch request data
2. Pass the data to updateHouseholdAndPrincipalDetailsService
3. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import { UpdateHouseholdPrincipalRequestSchema } from '../households.types.js';
import { updateHouseholdAndPrincipalDetailsService } from './updateHouseholdAndPrincipalService.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { AppError } from '../../../common/errors/appError.js';

export const updateHouseholdAndPrincipalDetailsController = async (req: Request, res: Response) => {
  const householdLogs = logger.child({
    service: 'updateHouseholdAndPrincipalDetailsController',
    requestId: randomUUID(),
  });

  // 1. Accept and validate the fetch request data
  const userId = req.userId;
  if (!userId || typeof userId !== 'string') {
    householdLogs.warn('User id missing or invalid format');

    throw new AppError(
      400,
      'USER_ID_FORMAT_MISMATCH',
      'User id missing or invalid format',
      'User id missing or invalid format',
    );
  }

  const { estateId, householdId, principalResidentId } = req.params;

  if (!estateId || typeof estateId !== 'string') {
    householdLogs.warn('Estate id missing or invalid format');

    throw new AppError(
      400,
      'ESTATE_ID_FORMAT_MISMATCH',
      'Estate id missing or invalid format',
      'Estate id missing or invalid format',
    );
  }

  if (!householdId || typeof householdId !== 'string') {
    householdLogs.warn('Household id missing or invalid format');

    throw new AppError(
      400,
      'HOUSEHOLD_ID_FORMAT_MISMATCH',
      'Household id missing or invalid format',
      'Household id missing or invalid format',
    );
  }

  if (!principalResidentId || typeof principalResidentId !== 'string') {
    householdLogs.warn('Principal person id missing or invalid format');

    throw new AppError(
      400,
      'PRINCIPAL_PERSON_ID_FORMAT_MISMATCH',
      'Principal person id missing or invalid format',
      'Principal person id missing or invalid format',
    );
  }

  const updateDataParseResult = UpdateHouseholdPrincipalRequestSchema.safeParse(req.body);
  if (!updateDataParseResult.success) {
    householdLogs.warn('Update data missing or invalid', {
      updateData: req.body,
    });

    throw new AppError(
      400,
      'UPDATE_DATA_FORMAT_MISMATCH',
      'Update data missing or invalid',
      'Update data missing or invalid',
    );
  }

  const updateData = updateDataParseResult.data;

  // 2. Pass the data to updateHouseholdAndPrincipalDetailsService
  const result = await updateHouseholdAndPrincipalDetailsService(
    userId,
    estateId,
    householdId,
    principalResidentId,
    updateData,
  );

  return res.status(200).json(result);
};
