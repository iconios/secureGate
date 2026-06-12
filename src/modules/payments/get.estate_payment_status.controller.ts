// Get Estate Payment Status Controller
/*
#Plan:
1. Accept and validate the callback request data.
2. Pass the validated data to the GetEstatePaymentStatusService.
3. Send the response back to the client
*/

/*
PAYMENT_DATA_NOT_FOUND                 -> failed/not-found page
PAYSTACK_VERIFICATION_API_ERROR        -> pending page
PAYSTACK_VERIFICATION_NETWORK_ERROR    -> pending page
PAYSTACK_VERIFICATION_PENDING          -> pending page
PAYMENT_NOT_SUCCESSFUL                 -> failed page
PAYMENT_AMOUNT_MISMATCH                -> failed/security page
PAYMENT_CURRENCY_MISMATCH              -> failed/security page
DATABASE_ERROR                         -> pending page
success                                -> success page
*/
import { Request, Response } from 'express';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import GetEstatePaymentStatusService from './get.estate_payment_status.service.js';
import { buildPaymentStatusUrl } from '../../utils/buildPaymentStatusUrl.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';

const GetEstatePaymentStatusController = async (req: Request, res: Response) => {
  const callbackLogs = logger.child({
    service: 'GetEstatePaymentStatusController',
    requestId: randomUUID(),
  });

  const frontendUrl = process.env.FRONTEND_URL;
  let normalizedReference;

  try {
    // 1. Accept and validate the callback request data.
    if (!frontendUrl) {
      callbackLogs.warn('Frontend url not found');
      return res
        .status(500)
        .json(
          errorResponseHelper(
            'Frontend url not found',
            'FRONTEND_URL_NOT_FOUND',
            'Frontend url not found',
          ),
        );
    }

    const { reference } = req.query;
    if (!reference) {
      callbackLogs.warn('Reference data not found');
      return res
        .status(404)
        .json(
          errorResponseHelper(
            'Reference data not found',
            'REFERENCE_NOT_FOUND',
            'Reference data not found',
          ),
        );
    }

    if (typeof reference !== 'string') {
      callbackLogs.warn('Invalid reference');
      return res.redirect(buildPaymentStatusUrl(frontendUrl, 'failed', 'invalid_reference'));
    }

    normalizedReference = reference.trim();
    if (!normalizedReference) {
      callbackLogs.warn('Empty and invalid reference');
      return res.redirect(buildPaymentStatusUrl(frontendUrl, 'failed', 'invalid_reference'));
    }

    // 2. Pass the validated data to the GetEstatePaymentStatusService.
    const result = await GetEstatePaymentStatusService(normalizedReference);

    // 3. Send the response back to the client
    if (!result.success) {
      switch (result.error?.code) {
        case 'PAYSTACK_VERIFICATION_API_ERROR':
        case 'PAYSTACK_VERIFICATION_NETWORK_ERROR':
        case 'PAYSTACK_VERIFICATION_PENDING':
        case 'DATABASE_ERROR':
        case 'INTERNAL_SERVER_ERROR':
        case 'PAYMENT_UPDATE_ERROR':
        case 'ESTATE_UPDATE_ERROR':
          return res.redirect(
            buildPaymentStatusUrl(
              frontendUrl,
              'pending',
              'verification_pending',
              normalizedReference,
            ),
          );
        case 'PAYMENT_NOT_SUCCESSFUL':
          return res.redirect(
            buildPaymentStatusUrl(
              frontendUrl,
              'failed',
              'payment_not_successful',
              normalizedReference,
            ),
          );
        case 'PAYMENT_AMOUNT_MISMATCH':
        case 'PAYMENT_CURRENCY_MISMATCH':
        case 'PAYMENT_REF_MISMATCH':
        case 'PAYMENT_IDENTITY_MISMATCH':
        case 'ESTATE_IDENTITY_MISMATCH':
        case 'ESTATE_SUBSCRIPTION_PLAN_MISMATCH':
        case 'MANAGER_IDENTITY_MISMATCH':
        case 'SUBSCRIPTION_PERIOD_MISMATCH':
        case 'ESTATE_MANAGER_RELATIONSHIP_NOT_FOUND':
          return res.redirect(
            buildPaymentStatusUrl(
              frontendUrl,
              'failed',
              'verification_failed',
              normalizedReference,
            ),
          );
        case 'PAYMENT_DATA_NOT_FOUND':
          return res.redirect(
            buildPaymentStatusUrl(frontendUrl, 'failed', 'payment_not_found', normalizedReference),
          );
        default:
          return res.redirect(
            buildPaymentStatusUrl(frontendUrl, 'pending', 'unknown_status', normalizedReference),
          );
      }
    }

    return res.redirect(
      buildPaymentStatusUrl(frontendUrl, 'success', undefined, normalizedReference),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error?.message : 'Unknown error';
    callbackLogs.error(errorMessage, {
      error: error,
    });

    if (frontendUrl) {
      return res.redirect(
        buildPaymentStatusUrl(frontendUrl, 'pending', 'server_error', normalizedReference),
      );
    }

    return res
      .status(500)
      .json(errorResponseHelper('Unexpected error', 'SERVER_ERROR', 'Unexpected error'));
  }
};

export default GetEstatePaymentStatusController;
