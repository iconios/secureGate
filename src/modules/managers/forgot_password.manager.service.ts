// Forgot Password Manager Service
/**
 * This service is responsible for handling the logic related to the forgot password functionality for managers. It interacts with the database to find the user and updates the password reset code as needed. It also handles sending the password reset code to the user's email.
 * The service includes methods for:
 * - Finding the user by their email.
 * - Generating a new password reset code.
 * - Sending the password reset code to the user's email.
 */

import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../common/supabase/supabase';
import logger from '../../common/winston/logger';
import { errorResponseHelper } from '../../utils/errorResponseHelper';
import { hashString } from '../../utils/hashHelper';
import { tokenGenHelper } from '../../utils/tokenGenHelper';
import { ForgotPasswordData, ForgotPasswordDataSchema } from './managers.types';
import { redactEmailUsername } from '../../utils/redactEmailUsername';
import { userAccountSettings } from '../../common/configs';
import sendPasswordResetEmail from '../../common/postmark/resetPasswordEmail';
import { successResponseHelper } from '../../utils/successResponseHelper';
import { ZodError } from 'zod';

/*
#Plan:
1. Accept and validate the email for the request
2. Find the user in the database using the provided email
3. If the user is not found, return an error response
4. If the user is found, generate a new password reset code
5. Update the user's record in the database with the new password reset code
6. Send the new password reset code to the user's email
7. Return a success response indicating that the password reset code has been sent 
*/

const ForgotPasswordManagerService = async (email: ForgotPasswordData) => {
  const now = new Date();
  const { cooldownMinutes, windowMinutes, maxSendsPerWindow, codeExpiryMinutes } =
    userAccountSettings();

  const managerLogs = logger.child({
    service: 'forgotPasswordManagerService',
    requestId: randomUUID(),
  });

  try {
    // Step 1: Accept and validate the email for the request
    const { email: userEmail } = ForgotPasswordDataSchema.parse(email);

    // Step 2: Find the user in the database using the provided email
    const { data: user, error: findError } = await supabaseAdmin
      .from('managers')
      .select('id, email, full_name')
      .eq('email', userEmail)
      .maybeSingle();

    if (findError || !user) {
      // Step 3: If the user is not found, return an error response
      managerLogs.error(`Password reset user not found for ${redactEmailUsername(userEmail)}`, {
        error: findError ?? '',
      });

      return errorResponseHelper(
        'If an account exists for this email, a password reset code has been sent.',
        'USER_NOT_FOUND',
        'If an account exists for this email, a password reset code has been sent.',
        findError,
      );
    }

    // Step 4: If the user is found, generate a new password reset code
    const newResetCode = tokenGenHelper();
    const hashedResetCode = await hashString(newResetCode);

    // Step 5: Update the user's record in the database with the new password reset code
    const { data: existingRequest, error: selectError } = await supabaseAdmin
      .from('email_verification_requests')
      .select('id, sent_count, window_started_at, window_expires_at, next_allowed_at')
      .eq('email', userEmail)
      .eq('purpose', 'password_reset')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      managerLogs.error(
        `Error checking existing password request for email: ${redactEmailUsername(userEmail)}`,
        {
          error: selectError,
        },
      );

      return errorResponseHelper(
        'Error checking exisiting request',
        'DATABASE_ERROR',
        'Error checking exisiting request',
        selectError,
      );
    }

    if (existingRequest) {
      const { sent_count, window_started_at, window_expires_at, next_allowed_at } = existingRequest;

      if (sent_count >= maxSendsPerWindow && now < new Date(window_expires_at)) {
        managerLogs.warn(
          `Maximum resend attempts reached for email: ${redactEmailUsername(userEmail)}. Sent count: ${sent_count}, Window expires at: ${window_expires_at}`,
        );
        return errorResponseHelper(
          'Maximum resend attempts reached. Please try again later.',
          'MAX_ATTEMPTS_REACHED',
          'Maximum resend attempts reached. Please try again later.',
        );
      }

      if (now < new Date(next_allowed_at)) {
        managerLogs.warn(
          `Cooldown active for email: ${redactEmailUsername(userEmail)}. Next allowed at: ${next_allowed_at}`,
        );
        return errorResponseHelper(
          `Please wait before requesting another code.`,
          'COOLDOWN_ACTIVE',
          `Please wait before requesting another code.`,
        );
      }

      const { error: revokeError } = await supabaseAdmin
        .from('email_verification_requests')
        .update({
          status: 'revoked',
        })
        .neq('id', existingRequest.id)
        .eq('status', 'pending')
        .eq('purpose', 'password_reset')
        .eq('email', userEmail);

      if (revokeError) {
        return errorResponseHelper(
          'Error updating password reset request.',
          'DATABASE_ERROR',
          'Error updating password reset request.',
          revokeError,
        );
      }

      const windowExpiresAt = window_expires_at ? new Date(window_expires_at) : null;
      const isWindowExpired = !windowExpiresAt || now >= windowExpiresAt;
      const nextSentCount = isWindowExpired ? 1 : sent_count + 1;
      const nextWindowStartedAt = isWindowExpired ? now.toISOString() : window_started_at;
      const nextWindowExpiresAt = isWindowExpired
        ? new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString()
        : window_expires_at;

      const { error: updateError } = await supabaseAdmin
        .from('email_verification_requests')
        .update({
          code_hash: hashedResetCode,
          sent_count: nextSentCount,
          last_sent_at: now.toISOString(),
          next_allowed_at: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
          window_started_at: nextWindowStartedAt,
          window_expires_at: nextWindowExpiresAt,
          code_expires_at: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000).toISOString(),
        })
        .eq('id', existingRequest.id);

      if (updateError) {
        managerLogs.error(
          `Error updating verification request for email: ${redactEmailUsername(userEmail)}`,
          {
            error: updateError,
          },
        );
        return errorResponseHelper(
          'Error updating verification request.',
          'DATABASE_ERROR',
          'Error updating verification request.',
          updateError,
        );
      }

      // Step 6. Send the new password reset code to the user's email
      managerLogs.info(
        `Updated existing password reset request and sent email for: ${redactEmailUsername(userEmail)}`,
      );
      await sendPasswordResetEmail(userEmail, newResetCode, user.full_name, existingRequest.id);

      // Step 7. Return a success response indicating that the password reset code has been sent
      managerLogs.info(
        `Password reset link resent successfully to email: ${redactEmailUsername(userEmail)}`,
      );
      return successResponseHelper(
        'If an account exists with this email, a password reset link has been sent',
        {
          email: userEmail,
        },
      );
    } else {
      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('email_verification_requests')
        .insert({
          email: userEmail,
          code_hash: hashedResetCode,
          purpose: 'password_reset',
          sent_count: 1,
          last_sent_at: now.toISOString(),
          next_allowed_at: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
          window_started_at: now.toISOString(),
          window_expires_at: new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString(),
          code_expires_at: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        managerLogs.error(
          `Error creating password reset request for email: ${redactEmailUsername(userEmail)}`,
          {
            error: insertError,
          },
        );
        return errorResponseHelper(
          'Error creating password reset request.',
          'DATABASE_ERROR',
          'Error creating password reset request.',
          insertError,
        );
      }

      // Step 6. Send the new password reset code to the user's email
      managerLogs.info(
        `Created new password reset request and sent email for email: ${redactEmailUsername(userEmail)}`,
      );
      await sendPasswordResetEmail(userEmail, newResetCode, user.full_name, insertData.id);

      // Step 7. Return a success response indicating that the password reset code has been sent
      managerLogs.info(
        `Password reset link sent successfully to email: ${redactEmailUsername(userEmail)}`,
      );
      return successResponseHelper(
        'If an account exists with this email, a password reset link has been sent',
        { email: userEmail },
      );
    }
  } catch (error) {
    managerLogs.error('An unexpected error occurred while resending password reset link.', {
      email,
      error,
    });

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

export default ForgotPasswordManagerService;
