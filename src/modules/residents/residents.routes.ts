import { Router } from 'express';
import { getAllNonPrincipalResidentsByEstateController } from './getNonPrincipalResidentsByEstate/getNonPrincipalResidentsController.js';
import extractToken from '../../middleware/extractToken.js';
import authenticateToken from '../../middleware/authenticateToken.js';
import { getAllNonPrincipalResidentsByHouseholdController } from './getNonPrincipalsByHousehold/getNonPrincipalsController.js';
import { swapPrincipalResidentController } from './swapPrincipalResident/swapPrincipalResidentController.js';
import { getResidentsByEstateController } from './getResidentsByEstate/getResidentsByEstateController.js';

export const residentsRouter = Router();

residentsRouter.use(extractToken, authenticateToken);
residentsRouter.get('/non-principals/by-estate', getAllNonPrincipalResidentsByEstateController);
residentsRouter.get(
  '/nonPrincipals/estate/:estateId/household/:householdId',
  getAllNonPrincipalResidentsByHouseholdController,
);
residentsRouter.patch(
  '/swap/principals/estate/:estateId/household/:householdId',
  swapPrincipalResidentController,
);
residentsRouter.get('/overviewData/estate/:estateId', getResidentsByEstateController);
