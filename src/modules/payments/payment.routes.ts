import { Router } from 'express';
import InitializeEstateSubscriptionPaymentController from './initialize.estate_subscription.payment.controller.js';

const PaymentRouter = Router();

PaymentRouter.post('/initialize/paystack/payment', InitializeEstateSubscriptionPaymentController);

export default PaymentRouter;
