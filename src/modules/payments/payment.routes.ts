import { Router } from 'express';
import InitializeEstateSubscriptionPaymentController from './initialize.estate_subscription.payment.controller.js';
import GetEstatePaymentStatusController from './get.estate_payment_status.controller.js';
import { GetEstateDatabaseStatusController } from './get_estate_db_status/get.estate_db_status.controller.js';
import extractToken from '../../middleware/extractToken.js';
import authenticateToken from '../../middleware/authenticateToken.js';

const PaymentRouter = Router();

PaymentRouter.post(
  '/initialize/paystack/payment',
  extractToken,
  authenticateToken,
  InitializeEstateSubscriptionPaymentController,
);
PaymentRouter.get('/callback', GetEstatePaymentStatusController);
PaymentRouter.post(
  '/estate/status',
  extractToken,
  authenticateToken,
  GetEstateDatabaseStatusController,
);

export default PaymentRouter;
