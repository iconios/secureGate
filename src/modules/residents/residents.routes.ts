import { Router } from 'express';
import { getAllNonPrincipalResidentsByEstateController } from './get_nonPrincipal_residents_byEstate/get_nonPrincipal_residents_controller.js';
import extractToken from '../../middleware/extractToken.js';
import authenticateToken from '../../middleware/authenticateToken.js';
import { getAllNonPrincipalResidentsByHouseholdController } from './getNonPrincipalsByHousehold/getNonPrincipalsController.js';
import { swapPrincipalResidentController } from './swapPrincipalResident/swapPrincipalResidentController.js';

export const residentsRouter = Router();

residentsRouter.use(extractToken, authenticateToken);
residentsRouter.get('/non-principals/by-estate', getAllNonPrincipalResidentsByEstateController);
residentsRouter.get(
  '/nonPrincipals/estate/:estateId/household/:householdId',
  getAllNonPrincipalResidentsByHouseholdController,
);
residentsRouter.patch(
  'swap/principals/estate/:estateId/household/:householdId',
  swapPrincipalResidentController,
);
