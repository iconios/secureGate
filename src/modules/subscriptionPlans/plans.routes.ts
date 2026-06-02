import { Router } from 'express';
import FetchSubscriptionPlansController from './fetch.plans.controller.js';

const PlansRouter = Router();

PlansRouter.get('/', FetchSubscriptionPlansController);

export default PlansRouter;
