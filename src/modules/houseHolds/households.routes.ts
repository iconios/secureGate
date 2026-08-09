// Households routes
import { Router } from 'express';
import { CreateHouseholdsController } from './createHouseholds/createHouseholdsController.js';
import { FetchBlockOrStreetController } from './fetchBlockOrStreet/fetchBlockOrStreetController.js';
import extractToken from '../../middleware/extractToken.js';
import authenticateToken from '../../middleware/authenticateToken.js';
import { fetchHouseholdsByEstateController } from './fetchHouseholdsByEstate/fetchHouseholdsByEstateController.js';
import { updateHouseholdAndPrincipalDetailsController } from './updateHouseholdAndPrincipal/updateHouseholdAndPrincipalController.js';
import { deleteHouseholdController } from './deleteHousehold/deleteHouseholdController.js';

export const HouseholdsRouter = Router();

HouseholdsRouter.use(extractToken, authenticateToken);

HouseholdsRouter.post('/create', CreateHouseholdsController);
HouseholdsRouter.get('/fetch/blockorstreet', FetchBlockOrStreetController);
HouseholdsRouter.get('/fetch/by-estate', fetchHouseholdsByEstateController);
HouseholdsRouter.patch(
  '/update/estate/:estateId/household/:householdId/resident/:principalResidentId',
  updateHouseholdAndPrincipalDetailsController,
);
HouseholdsRouter.delete(
  '/delete/household/:householdId/estate/:estateId',
  deleteHouseholdController,
);
