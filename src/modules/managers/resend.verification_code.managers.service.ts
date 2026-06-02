// Resend Verification Code Manager Service
/**
 * This service is responsible for handling the logic related to resending verification codes to users. It interacts with the database to find the user and updates the verification code as needed. It also handles sending the new verification code to the user's email or phone number.
 * The service includes methods for:
 * - Finding the user by their email or phone number.
 * - Generating a new verification code.
 * - Sending the new verification code to the user.
 */

import { ResendVerificationCodeData, ResendVerificationCodeDataSchema } from './managers.types.js';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import { generateUniqueCode } from '../../utils/codeGenHelper.js';
import { hashString } from '../../utils/hashHelper.js';
import { userAccountSettings } from '../../common/configs.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import sendVerificationEmail from '../../common/postmark/verificationEmail.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { randomUUID } from 'crypto';
import logger from '../../common/winston/logger.js';
import { ZodError } from 'zod';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';

/*
#Plan:
1. Accept and validate the email for the request
2. Find the user in the database using the provided email
3. If the user is not found, return an error response
4. If the user is found, generate a new verification code
5. Update the user's record in the database with the new verification code
6. Send the new verification code to the user's email
7. Return a success response indicating that the verification code has been resent
*/

const ResendVerificationCodeManagerService = async (email: ResendVerificationCodeData) => {
  const now = new Date();
  const { cooldownMinutes, windowMinutes, maxSendsPerWindow, codeExpiryMinutes } =
    userAccountSettings();

  const managerLogs = logger.child({
    service: 'resendVerificationCodeManagerService',
    requestId: randomUUID(),
  });

  try {
    // Step 1: Accept and validate the email for the request
    const { email: userEmail } = ResendVerificationCodeDataSchema.parse(email);

    // Step 2: Find the user in the database using the provided email
    const { data: user, error: userError } = await supabaseAdmin
      .from('managers')
      .select('id, email, full_name, is_verified')
      .eq('email', userEmail)
      .maybeSingle();

    if (userError || !user) {
      // Step 3: If the user is not found, return an error response
      managerLogs.error(`User not found with email: ${redactEmailUsername(userEmail)}`, {
        error: userError,
      });
      return errorResponseHelper(
        'User not found with the provided email.',
        'USER_NOT_FOUND',
        'User not found with the provided email.',
        {
          error: userError ?? '',
        },
      );
    }

    if (user.is_verified) {
      return successResponseHelper(
        'If this account requires verification, a verification code has been sent.',
      );
    }

    // Step 4: If the user is found, generate a new verification code
    const newVerificationCode = generateUniqueCode();
    const hashedVerificationCode = await hashString(newVerificationCode);

    // Step 5: Update the user's record in the database with the new verification code
    const { data: existingRequest, error: selectError } = await supabaseAdmin
      .from('email_verification_requests')
      .select('id, sent_count, window_started_at, window_expires_at, next_allowed_at')
      .eq('email', userEmail)
      .eq('purpose', 'account_registration')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      managerLogs.error(
        `Error checking existing verification requests for email: ${redactEmailUsername(userEmail)}`,
        {
          error: selectError,
        },
      );
      return errorResponseHelper(
        'Error checking existing verification requests.',
        'DATABASE_ERROR',
        'Error checking existing verification requests.',
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
          code_hash: hashedVerificationCode,
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

      // Step 6: Send the new verification code to the user's email
      managerLogs.info(
        `Updated existing verification request and sent email for email: ${redactEmailUsername(userEmail)}`,
      );
      await sendVerificationEmail(userEmail, newVerificationCode, user.full_name);

      // Step 7: Return a success response indicating that the verification code has been resent
      managerLogs.info(
        `Verification code resent successfully to email: ${redactEmailUsername(userEmail)}`,
      );
      return successResponseHelper('Verification code resent successfully.', { email: userEmail });
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('email_verification_requests')
        .insert({
          email: userEmail,
          code_hash: hashedVerificationCode,
          purpose: 'account_registration',
          sent_count: 1,
          last_sent_at: now.toISOString(),
          next_allowed_at: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
          window_started_at: now.toISOString(),
          window_expires_at: new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString(),
          code_expires_at: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000).toISOString(),
          status: 'pending',
        });

      if (insertError) {
        managerLogs.error(
          `Error creating verification request for email: ${redactEmailUsername(userEmail)}`,
          {
            error: insertError,
          },
        );
        return errorResponseHelper(
          'Error creating verification request.',
          'DATABASE_ERROR',
          'Error creating verification request.',
          insertError,
        );
      }

      // Step 6: Send the new verification code to the user's email
      managerLogs.info(
        `Created new verification request and sent email for email: ${redactEmailUsername(userEmail)}`,
      );
      await sendVerificationEmail(userEmail, newVerificationCode, user.full_name);

      // Step 7: Return a success response indicating that the verification code has been resent
      managerLogs.info(
        `Verification code sent successfully to email: ${redactEmailUsername(userEmail)}`,
      );
      return successResponseHelper('Verification code sent successfully.', { email: userEmail });
    }
  } catch (error) {
    managerLogs.error('An unexpected error occurred while resending verification code.', {
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

export default ResendVerificationCodeManagerService;
