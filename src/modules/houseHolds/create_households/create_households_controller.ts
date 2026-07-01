// Create Households Controller
/*
#Plan:
1. Accept and validate the household creation data
2. Pass the data to CreateHouseholdsService
3. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import { CreateHouseholdControllerInputType } from '../households.types.js';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { CreateHouseholdsService } from './create_households_service.js';

export const CreateHouseholdsController = async (
  req: Request<{}, {}, CreateHouseholdControllerInputType>,
  res: Response,
) => {
  try {
    // Step 1. Accept and validate the household creation data
    const userId = req.userId;
    if (!userId) {
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

    const householdData = req.body;

    // Step 2. Pass the data to CreateHouseholdsService
    const data = {
      ...householdData,
      createdByManagerId: userId,
    };
    const result = await CreateHouseholdsService(data);

    // Step 3. Send the appropriate response to the caller/client
    if (!result.success) {
      switch (result.error?.code) {
        case 'HOUSEHOLD_UNIT_ALREADY_IN_USE':
        case 'EMAIL_OR_PHONE_ALREADY_IN_USE':
          return res.status(409).json(result);
        case 'UNAUTHORIZED':
          return res.status(401).json(result);
        case 'HOUSEHOLDS_DATA_NOT_FOUND':
        case 'PERSONS_NOT_FOUND':
          return res.status(404).json(result);
        case 'DUPLICATE_HOUSEHOLD_UNITS_IN_REQUEST':
        case 'DUPLICATE_PEOPLE_IN_REQUEST':
        case 'CANNOT_BE_IN_MULTIPLE_HOUSEHOLDS':
        case 'DUPLICATE_RECORD':
          return res.status(400).json(result);
        default:
          return res.status(500).json(result);
      }
    }

    return res.status(201).json(result);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return res
      .status(500)
      .json(errorResponseHelper('Internal server error', 'SERVER_ERROR', errMessage, error));
  }
};
