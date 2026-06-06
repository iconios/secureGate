import { Router } from 'express';
import GetManagerEstatesController from './get.manager_estates.controller.js';
import extractToken from '../../middleware/extractToken.js';
import authenticateToken from '../../middleware/authenticateToken.js';

export const EstatesManagerRouter = Router();

EstatesManagerRouter.use(extractToken); // Middleware to extract token and set req.userId
EstatesManagerRouter.use(authenticateToken); // Middleware to authenticate token and set req.userId
EstatesManagerRouter.get('/estates/dashboard', GetManagerEstatesController);
