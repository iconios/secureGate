// Households routes
import { Router } from 'express';
import { CreateHouseholdsController } from './create_households/create_households_controller.js';
import { FetchBlockOrStreetController } from './fetch_blockOrStreet/fetch_blockOrStreet_controller.js';
import extractToken from '../../middleware/extractToken.js';
import authenticateToken from '../../middleware/authenticateToken.js';
import { fetchHouseholdsByEstateController } from './fetch_households_by_estate/fetch_households_by_estate_controller.js';

export const HouseholdsRouter = Router();

HouseholdsRouter.use(extractToken, authenticateToken);

HouseholdsRouter.post('/create', CreateHouseholdsController);
HouseholdsRouter.get('/fetch/blockorstreet', FetchBlockOrStreetController);
HouseholdsRouter.get('/fetch/by-estate', fetchHouseholdsByEstateController);
