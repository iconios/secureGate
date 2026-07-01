// Households routes
import { Router } from 'express';
import { CreateHouseholdsController } from './create_households/create_households_controller.js';

export const HouseholdsRouter = Router();

HouseholdsRouter.post('/create', CreateHouseholdsController);
