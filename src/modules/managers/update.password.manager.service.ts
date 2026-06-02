// Update Password Manager Service
/**
 * The Update Password Manager Service is responsible for securely completing the manager
 * password reset process after a valid reset token has been issued.
 * Its main purpose is to accept the manager’s reset token and new password, verify that
 * the token is still valid, and safely update the manager’s password in the database.
 */

import { ZodError } from 'zod';
import { PasswordUpdateData, PasswordUpdateDataSchema } from './managers.types.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import { compareString, hashString } from '../../utils/hashHelper.js';
import sendPasswordUpdateSuccessfulEmail from '../../common/postmark/successPasswordUpdateEmail.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';

/*
#Plan:
1. Accept and validate the update password data:
   - request_id
   - token
   - new password
2. Find the pending password_reset request using request_id:
   - request exists
   - purpose is password_reset
   - status is pending
3. Get the manager/user email from the password reset request record.
4. Validate the token:
   - token hash matches the stored code_hash
   - code_expires_at is greater than the current time
5. If the token is invalid or expired:
   - return an invalid or expired token response
   - if expired, optionally mark the reset request as expired
6. Hash the new password securely.
7. Call RPC to:
   - update the manager/user password
   - mark the current password reset request as used
   - revoke any other pending password_reset requests for the same manager/user
8. Send password reset success email to the user.
9. Return a success response.
*/

const UpdatePasswordManagerService = async (passwordUpdateData: PasswordUpdateData) => {
  const now = new Date();
  const managerLogs = logger.child({
    service: 'UpdatePasswordManagerService',
    requestId: randomUUID(),
  });

  let emailInProcess = '';

  try {
    // Step 1. Accept and validate the update password data
    const { request_id, password, token } = PasswordUpdateDataSchema.parse(passwordUpdateData);

    // Step 2. Find the pending password_reset request using request_id
    const { data: pendingRequestData, error: pendingRequestError } = await supabaseAdmin
      .from('email_verification_requests')
      .select('id, code_hash, code_expires_at, email')
      .eq('status', 'pending')
      .eq('purpose', 'password_reset')
      .eq('id', request_id)
      .maybeSingle();

    if (pendingRequestError || !pendingRequestData) {
      managerLogs.warn('Invalid or missing password reset request');

      return errorResponseHelper(
        'Invalid or expired token',
        'INVALID_TOKEN',
        'Invalid or expired token',
        pendingRequestError,
      );
    }

    emailInProcess = pendingRequestData.email;

    // Step 3. Get the manager/user email from the password reset request record
    const { data: userData, error: userError } = await supabaseAdmin
      .from('managers')
      .select('id, email, full_name')
      .eq('email', pendingRequestData.email)
      .single();

    if (userError) {
      managerLogs.error(
        `Error fetching user data for ${redactEmailUsername(pendingRequestData.email)} `,
      );
      return errorResponseHelper(
        'Invalid or expired token',
        'INVALID_OR_EXPIRED_TOKEN',
        'Invalid or expired token',
        userError,
      );
    }

    // Step 4. Validate the token
    const isTokenMatch = await compareString(token, pendingRequestData.code_hash);
    // 5. If the token is invalid, return an invalid or expired token response
    if (!isTokenMatch) {
      managerLogs.error(`Invalid token for ${redactEmailUsername(pendingRequestData.email)}`);

      return errorResponseHelper(
        'Invalid or expired token',
        'INVALID_TOKEN',
        'Invalid or expired token',
      );
    }

    if (new Date(pendingRequestData.code_expires_at) < now) {
      // 5. If the token is expired, mark expired token as expired and return an invalid or expired token response
      managerLogs.error(`Expired token for ${redactEmailUsername(pendingRequestData.email)}`);

      const { error: expireRequestError } = await supabaseAdmin
        .from('email_verification_requests')
        .update({ status: 'expired' })
        .eq('id', pendingRequestData.id);

      if (expireRequestError) {
        managerLogs.error(
          `Error marking expired password reset request for ${redactEmailUsername(pendingRequestData.email)}`,
          { error: expireRequestError },
        );
      }

      return errorResponseHelper(
        'Invalid or expired token',
        'INVALID_TOKEN',
        'Invalid or expired token',
      );
    }

    // Step 6. Hash the new password securely
    const passwordHash = await hashString(password);

    // Step 7. Call RPC to update password + token statuses
    const { error: rpcError } = await supabaseAdmin.rpc('update_manager_password_after_reset', {
      p_email: userData.email,
      p_manager_id: userData.id,
      p_password_hash: passwordHash,
      p_reset_request_id: pendingRequestData.id,
    });

    if (rpcError) {
      managerLogs.error(
        `Error completing password update transaction for ${redactEmailUsername(userData.email)}`,
        {
          error: rpcError,
        },
      );

      return errorResponseHelper(
        'Error updating user password',
        'DATABASE_ERROR',
        'Error updating user password',
        rpcError,
      );
    }

    // Step 8. Send password reset success email to the user
    await sendPasswordUpdateSuccessfulEmail(userData.email, userData.full_name, now);

    // Step 9. Return a success response
    return successResponseHelper('Password update successful');
  } catch (error) {
    managerLogs.error(
      `An error occurred while updating the password for ${redactEmailUsername(emailInProcess)}`,
      {
        error,
      },
    );

    if (error instanceof ZodError) {
      return errorResponseHelper(
        'Invalid input data.',
        'BAD_REQUEST',
        'Invalid input data.',
        error,
      );
    }

    return errorResponseHelper(
      'An unexpected error occurred.',
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred.',
      error,
    );
  }
};

export default UpdatePasswordManagerService;
