import { Router } from 'express';
import { UnpaidEstateAndPaymentEntriesDeletionController } from './dbMaintenanceController.js';

export const dbMaintenanceRouter = Router();

dbMaintenanceRouter.post('/cleanup', UnpaidEstateAndPaymentEntriesDeletionController);
