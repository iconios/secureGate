import { Router } from 'express';
import { UnpaidEstateAndPaymentEntriesDeletionController } from './unpaidEstateAndPaymentDeletioController.js';

export const dbMaintenanceRouter = Router();

dbMaintenanceRouter.post('/cleanup', UnpaidEstateAndPaymentEntriesDeletionController);
