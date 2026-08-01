// Update Household And Principal Details Controller
/*
#Plan:
1. Accept and validate the fetch request data
2. Pass the data to updateHouseholdAndPrincipalDetailsService
3. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { UpdateHouseholdPrincipalRequestSchema } from '../households.types.js';
import { updateHouseholdAndPrincipalDetailsService } from './update.household.principal.service.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';

export const updateHouseholdAndPrincipalDetailsController = async (req: Request, res: Response) => {
  const householdLogs = logger.child({
    service: 'updateHouseholdAndPrincipalDetailsController',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the fetch request data
    const userId = req.userId;
    if (!userId || typeof userId === 'string') {
      householdLogs.warn('User id missing or invalid format');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'User id missing or invalid format',
            'USER_ID_FORMAT_MISMATCH',
            'User id missing or invalid format',
          ),
        );
    }

    const { estateId, householdId, principalPersonId } = req.query;

    if (!estateId || typeof estateId !== 'string') {
      householdLogs.warn('Estate id missing or invalid format');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Estate id missing or invalid format',
            'ESTATE_ID_FORMAT_MISMATCH',
            'Estate id missing or invalid format',
          ),
        );
    }

    if (!householdId || typeof householdId !== 'string') {
      householdLogs.warn('Household id missing or invalid format');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Household id missing or invalid format',
            'HOUSEHOLD_ID_FORMAT_MISMATCH',
            'Household id missing or invalid format',
          ),
        );
    }

    if (!principalPersonId || typeof principalPersonId !== 'string') {
      householdLogs.warn('Principal person id missing or invalid format');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Principal person id missing or invalid format',
            'PRINCIPAL_PERSON_ID_FORMAT_MISMATCH',
            'Principal person id missing or invalid format',
          ),
        );
    }

    const updateDataParseResult = UpdateHouseholdPrincipalRequestSchema.safeParse(
      req.body.updateData,
    );
    if (!updateDataParseResult.success) {
      householdLogs.warn('Update data missing or invalid');
      return res
        .status(400)
        .json(
          errorResponseHelper(
            'Update data missing or invalid',
            'UPDATE_DATA_FORMAT_MISMATCH',
            'Update data missing or invalid',
          ),
        );
    }

    const updateData = updateDataParseResult.data;

    // 2. Pass the data to updateHouseholdAndPrincipalDetailsService
    const result = await updateHouseholdAndPrincipalDetailsService(
      userId,
      estateId,
      householdId,
      principalPersonId,
      updateData,
    );

    if (!result.success) {
      switch (result.error?.code) {
        case 'ESTATE_ID_REQUIRED':
        case 'HOUSEHOLD_ID_REQUIRED':
        case 'PRINCIPAL_PERSON_ID_REQUIRED':
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
          'Internal server error',
          error,
        ),
      );
  }
};
