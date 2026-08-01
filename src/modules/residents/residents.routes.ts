import { Router } from 'express';
import { getAllNonPrincipalResidentsByEstateController } from './get_nonPrincipal_residents/get_nonPrincipal_residents_controller.js';
import extractToken from '../../middleware/extractToken.js';
import authenticateToken from '../../middleware/authenticateToken.js';

export const residentsRouter = Router();

residentsRouter.use(extractToken, authenticateToken);
residentsRouter.get('/non-principals/by-estate', getAllNonPrincipalResidentsByEstateController);
