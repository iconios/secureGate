// Initialie Paystack Transaction Service
/*
#Plan:
1. Accept and validate the input payload
2. Confirm the availability of paystack secret key
3. Call the paystack initialization service
4. Send the response to the call
*/

import { PaystackInitializeResponse, PaystackInitializePayload } from './payment.types.js';

export const initializePaystackTransactionService = async (
  payload: PaystackInitializePayload,
): Promise<PaystackInitializeResponse> => {
  try {
    // 2. Confirm the availability of paystack secret key
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw new Error(
        'InitializePaystackTransactionService: Payment provider secret key is missing',
      );
    }

    // 3. Call the paystack initialization service
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as PaystackInitializeResponse;

    // 4. Send the response to the call
    if (!response.ok || !result.status) {
      return {
        status: false,
        message: `result.message || 'Unable to initialize paystack payment'`,
        data: null,
      };
    }

    return result;
  } catch (error: unknown) {
    const errMessage =
      error instanceof Error ? error?.message : 'Unknown error while initializing payment';
    return {
      status: false,
      message: errMessage,
      data: null,
    };
  }
};
