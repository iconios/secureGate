import { Router } from 'express';
import InitializeEstateSubscriptionPaymentController from './initialize.estate_subscription.payment.controller.js';
import GetEstatePaymentStatusController from './get.estate_payment_status.controller.js';

const PaymentRouter = Router();

PaymentRouter.post('/initialize/paystack/payment', InitializeEstateSubscriptionPaymentController);
PaymentRouter.get('/callback', GetEstatePaymentStatusController);

export default PaymentRouter;
