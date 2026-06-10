import express, { Router } from 'express';
import InitializeEstateSubscriptionPaymentController from './initialize.estate_subscription.payment.controller.js';
import UpdateEstatePaymentDetailsController from './update.estate_payment_details.controller.js';

const PaymentRouter = Router();

PaymentRouter.post('/initialize/paystack/payment', InitializeEstateSubscriptionPaymentController);

export default PaymentRouter;
