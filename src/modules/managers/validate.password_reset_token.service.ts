// Validate Manager Password Reset Token Service
/**
 * This service is responsible for validating the password reset token provided by the manager. It checks if the token is valid, not expired, and matches the one stored in the database for the manager. If the token is valid, it allows the manager to proceed with resetting their password.
 * The service includes methods for:
 * - Validating the password reset token against the database.
 * - Checking if the token has expired.
 * - Returning appropriate responses based on the validation results.
 */

import { ZodError } from 'zod';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { compareString } from '../../utils/hashHelper.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { ValidateTokenData, ValidateTokenDataSchema } from './managers.types.js';
import { randomUUID } from 'crypto';
import logger from '../../common/winston/logger.js';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';

/*
#Plan:
1. Accept and validate the password reset token for the request
2. Find the user in the database using the provided token
3. If the user is not found, return an error response
4. If user is found but the token is invalid, return an error response
5. If the user is found and the token is valid, check if the token has expired
6. If the token has expired, delete the request and return an error response
7. If the token is valid and not expired, return a success response indicating that the token is valid and the manager can proceed with resetting their password
*/

const ValidateManagerPasswordResetTokenService = async (validateTokenData: ValidateTokenData) => {
  const now = new Date();
  const managerLogs = logger.child({
    service: 'ValidateManagerPasswordResetTokenService',
    requestId: randomUUID(),
  });

  let requestId = '';

  try {
    // Step 1: Accept and validate the password reset token for the request
    const { request_id, token } = ValidateTokenDataSchema.parse(validateTokenData);
    requestId = request_id;

    // Step 2: Find the request in the database using the provided token
    const { data: existingRequest, error: findError } = await supabaseAdmin
      .from('email_verification_requests')
      .select('id, email, code_hash, code_expires_at')
      .eq('id', request_id)
      .eq('purpose', 'password_reset')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError || !existingRequest) {
      // Step 3. If the user is not found, return an error response
      managerLogs.error(
        `Password reset token validation failed for request ID ${request_id}: No matching token found`,
        {
          error: findError ?? 'No matching token found',
        },
      );
      return errorResponseHelper(
        'Invalid or expired token',
        'INVALID_TOKEN',
        'The provided token is invalid or has expired.',
        findError,
      );
    }

    const isTokenValid = await compareString(token, existingRequest.code_hash);
    if (!isTokenValid) {
      // 4. If user is found but the token is invalid, return an error response
      managerLogs.error(
        `Password reset token validation failed for request ID ${request_id} and email ${redactEmailUsername(existingRequest.email)}`,
        {
          error: 'Invalid token',
        },
      );
      return errorResponseHelper(
        'Invalid or expired token',
        'INVALID_TOKEN',
        'The provided token is invalid or has expired.',
      );
    }

    // Step 5. If the user is found and the token is valid, check if the token has expired
    if (new Date(existingRequest.code_expires_at) < now) {
      // Step 6. If the token has expired, delete the request and return an error response
      managerLogs.error(
        `Password reset token validation failed for request ID ${requestId}: Token has expired`,
        {
          error: 'Token has expired',
        },
      );

      await supabaseAdmin
        .from('email_verification_requests')
        .update({ status: 'expired' })
        .eq('id', existingRequest.id);

      return errorResponseHelper(
        'Invalid or expired token',
        'TOKEN_EXPIRED',
        'The provided token has expired. Please request a new password reset.',
      );
    }

    // Step 7. If the token is valid and not expired, return a success response indicating that the token is valid and the manager can proceed with resetting their password
    managerLogs.info(
      `Password reset token validated successfully for request ID ${requestId} and email ${redactEmailUsername(existingRequest.email)}`,
    );

    return successResponseHelper(
      'The provided token is valid. You can proceed with resetting your password.',
      { email: existingRequest.email },
    );
  } catch (error) {
    managerLogs.error(`An error occurred while validating the token for request ID ${requestId}`, {
      error,
    });
    if (error instanceof ZodError) {
      return errorResponseHelper(
        'Invalid input data',
        'VALIDATION_ERROR',
        'The provided data is invalid. Please check the input and try again.',
        error,
      );
    }

    return errorResponseHelper(
      'An error occurred while validating the token',
      'INTERNAL_SERVER_ERROR',
      'Failed to validate the provided token.',
      error,
    );
  }
};

export default ValidateManagerPasswordResetTokenService;
