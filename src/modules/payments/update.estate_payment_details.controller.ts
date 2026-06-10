// Update Estate Payment Details Controller
/*
#Plan:
1. Accept and validate the payment request data.
2. Verify Paystack webhook signature.
3. Parse the webhook event.
4. Acknowledge receipt immediately to Paystack.
5. Process the Paystack event asynchronously.
6. Pass the validated data to the UpdateEstatePaymentDetailsService.
*/

import { createHmac, randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import UpdateEstatePaymentDetailsService from './update.estate_payment_details.service.js';
import logger from '../../common/winston/logger.js';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';

const UpdateEstatePaymentDetailsController = async (req: Request, res: Response) => {
  const webhookPayLogs = logger.child({
    service: 'UpdateEstatePaymentDetailsController',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the payment request data.
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackSecret) {
      webhookPayLogs.warn('Paystack secret is required');
      return res
        .status(404)
        .json(
          errorResponseHelper(
            'Paystack secret is required',
            'PAYSTACK_SECRET_MISSING',
            'Paystack secret is required',
          ),
        );
    }

    // 2. Verify Paystack webhook signature.
    const signature = req.headers['x-paystack-signature'];

    if (typeof signature !== 'string') {
      webhookPayLogs.warn('Invalid signature');
      return res.status(401).send('Invalid signature');
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

    const hash = createHmac('sha512', paystackSecret).update(rawBody).digest('hex');

    if (hash !== signature) {
      webhookPayLogs.warn('Invalid signature');
      return res.status(401).send('Invalid signature');
    }

    // 3. Parse the webhook event.
    let event;

    try {
      event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
    } catch (error) {
      webhookPayLogs.error('Invalid webhook JSON body', { error });
      return res.status(400).send('Invalid payload');
    }

    // 4. Acknowledge receipt immediately to paystack
    webhookPayLogs.info('Webhook received', {
      event: event?.event,
      reference: event?.data?.reference,
    });

    res.status(200).send('Webhook received');

    // 5. Process the Paystack event asynchronously.
    if (event.event !== 'charge.success') {
      webhookPayLogs.info('Ignored unsupported Paystack event', {
        event: event.event,
      });
      return;
    }

    const reference = event.data?.reference;
    const email = event.data?.customer.email;
    const amount = event.data?.amount;

    let metadata = event.data.metadata;

    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (error) {
        webhookPayLogs.error('Invalid metadata JSON', {
          metadata: metadata,
          error: error,
        });

        return;
      }
    }

    const payment_id = metadata?.payment_id;
    const estate_id = metadata?.estate_id;
    const plan_id = metadata?.plan_id;
    const user_id = metadata?.user_id;
    const currency = metadata?.currency;

    if (
      !currency ||
      !reference ||
      !payment_id ||
      !email ||
      !amount ||
      !estate_id ||
      !plan_id ||
      !user_id
    ) {
      webhookPayLogs.error('Missing required metadata', {
        metadata: metadata,
        reference: reference,
        email: redactEmailUsername(email),
        amount: amount,
        currency: currency,
        estate_id: estate_id,
        plan_id: plan_id,
        user_id: user_id,
      });
      return;
    }

    // 6. Pass the validated data to the UpdateEstatePaymentDetailsService.
    UpdateEstatePaymentDetailsService(
      email,
      amount,
      reference,
      payment_id,
      estate_id,
      user_id,
      plan_id,
      currency,
    ).catch((error) => {
      webhookPayLogs.error('Webhook processing failed', {
        error: error,
        reference: reference,
        payment_id: payment_id,
      });
    });

    return;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    webhookPayLogs.error(errorMessage, {
      error: error,
    });

    if (!res.headersSent) {
      return res
        .status(500)
        .json(errorResponseHelper(errorMessage, 'INTERNAL_SERVER_ERROR', errorMessage, error));
    }
    return;
  }
};

export default UpdateEstatePaymentDetailsController;
