// Create manager service
/* 
Plan:
1. Validate the input (full_name, email, password, phone)
2. Check whether manager already exists.
    if exists and verified
    Log every attempt and outcome
    return a safe existing-account response.
3. If exists and unverified, 
    apply email-based rate limit / reset cooldown
    don't resend verification email if window disallows and max sends reached.
    dont resend verification email if cooldown disallows.
    resend verification email only if cooldown allows.
    resend verification email if no email-based rate limit is hit.
    Log every attempt and outcome
    return generic success response
4. Create new manager account
5. Generate and store hashed verification code with expiry in database.
6. Send verification email
7. Log the outcome
8. Return generic success response
*/

import { ZodError } from 'zod';
import { userAccountSettings } from '../../common/configs.js';
import sendVerificationEmail from '../../common/postmark/verificationEmail.js';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { hashString } from '../../utils/hashHelper.js';
import { NewManagerData, NewManagerDataSchema } from './managers.types.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { maskPhone } from '../../utils/maskPhoneHelper.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { generateUniqueCode } from '../../utils/codeGenHelper.js';

const CreateManagerService = async (newManagerData: NewManagerData) => {
  const now = new Date();
  const isDev = process.env.NODE_ENV === 'development';
  const { cooldownMinutes, windowMinutes, maxSendsPerWindow, codeExpiryMinutes } =
    userAccountSettings();

  const managerLogs = logger.child({
    service: 'createManagerService',
    requestId: randomUUID(),
  });

  try {
    // 1. Validate request body
    const { email, password, full_name, phone } = NewManagerDataSchema.parse(newManagerData);

    // 2. Check whether manager already exists.
    //      if exists and verified
    //      Log every attempt and outcome
    //      return a safe existing-account response.
    const { data: existingManager, error: fetchError } = await supabaseAdmin
      .from('managers')
      .select('is_verified')
      .eq('email', email)
      .maybeSingle();

    if (fetchError) {
      managerLogs.error(`Database error while checking existing manager for email: ${email}`, {
        full_name,
        phone: maskPhone(phone),
        error: fetchError,
      });
      return errorResponseHelper(
        'Database error',
        'DATABASE_ERROR',
        'Error fetching manager from database',
        fetchError,
      );
    }

    if (existingManager?.is_verified) {
      // Log the attempt and outcome
      managerLogs.info(`Attempt to register with email: ${email}`, {
        full_name,
        phone: maskPhone(phone),
        outcome: 'email_in_use',
      });

      //  return a safe existing-account response.
      return errorResponseHelper(
        'Email already in use',
        'EMAIL_IN_USE',
        'A verified manager with this email already exists',
      );
    }

    // 3. If exists and unverified,
    // apply email-based rate limit / reset cooldown
    // don't resend verification email if window disallows and max sends reached.
    // dont resend verification email if cooldown disallows.
    // resend verification email only if cooldown allows.
    // resend verification email if no email-based rate limit is hit.
    // Log every attempt and outcome
    // return generic success response

    if (existingManager && !existingManager?.is_verified) {
      // apply email-based rate limit / reset cooldown
      const { data: recentRequests, error: recentRequestsError } = await supabaseAdmin
        .from('email_verification_requests')
        .select('id, next_allowed_at, window_expires_at, sent_count')
        .eq('email', email)
        .eq('purpose', 'account_registration')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentRequestsError) {
        managerLogs.error(
          `Database error while checking verification requests for email: ${email}`,
          {
            full_name,
            phone: maskPhone(phone),
            error: recentRequestsError,
          },
        );
        return errorResponseHelper(
          'Database error',
          'DATABASE_ERROR',
          'Error fetching recent verification requests from database',
          recentRequestsError,
        );
      }

      // don't resend verification email if window disallows and max sends reached.
      const windowExpiresAt = recentRequests?.window_expires_at
        ? new Date(recentRequests.window_expires_at)
        : null;
      const nextAllowedAt = recentRequests?.next_allowed_at
        ? new Date(recentRequests.next_allowed_at)
        : null;
      if (
        windowExpiresAt &&
        windowExpiresAt > now &&
        recentRequests?.sent_count >= maxSendsPerWindow
      ) {
        managerLogs.warn(
          `Verification email resend attempt exceeding window limit for email: ${email}`,
          {
            full_name,
            phone: maskPhone(phone),
            sent_count: recentRequests?.sent_count,
            window_expires_at: recentRequests?.window_expires_at?.toISOString(),
          },
        );
        return errorResponseHelper(
          'Too many attempts',
          'TOO_MANY_ATTEMPTS',
          `You have reached the maximum number of verification emails that can be sent in a ${windowMinutes} minute window. Please try again later.`,
        );
      }

      // dont resend verification email if cooldown disallows.
      if (nextAllowedAt && nextAllowedAt > now) {
        managerLogs.warn(`Verification email resend attempt during cooldown for email: ${email}`, {
          full_name,
          phone: maskPhone(phone),
          next_allowed_at: nextAllowedAt.toISOString(),
        });
        return errorResponseHelper(
          'Too many attempts',
          'TOO_MANY_ATTEMPTS',
          `You can request a new verification email after ${nextAllowedAt.toISOString()}`,
        );
      }

      // resend verification email if window allows and max sends not reached.
      if (recentRequests?.window_expires_at && recentRequests.window_expires_at < now) {
        const rawCode = generateUniqueCode();
        const newHashedCode = await hashString(rawCode);
        await supabaseAdmin
          .from('email_verification_requests')
          .update({
            sent_count: 1,
            code_hash: newHashedCode,
            code_expires_at: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000),
            next_allowed_at: new Date(now.getTime() + cooldownMinutes * 60 * 1000),
            window_started_at: now,
            window_expires_at: new Date(now.getTime() + windowMinutes * 60 * 1000),
            status: 'pending',
          })
          .eq('id', recentRequests.id);

        if (isDev) {
          console.log('Generated raw code for resending verification email:', rawCode); // Debug log to verify code generation
        }
        await sendVerificationEmail(email, rawCode, full_name);

        managerLogs.info(`Resent verification email during new window for email: ${email}`, {
          full_name,
          phone: maskPhone(phone),
          sent_count: 1,
        });
        return successResponseHelper(
          'A new verification code has been sent your email. Please check your inbox.',
        );
      }

      // resend verification email if recent request exists, window not expired, sent_count below max, and cooldown has passed
      if (
        recentRequests &&
        windowExpiresAt &&
        windowExpiresAt > now &&
        (!nextAllowedAt || nextAllowedAt <= now) &&
        recentRequests.sent_count < maxSendsPerWindow
      ) {
        const rawCode = generateUniqueCode();
        const codeHash = await hashString(rawCode);

        const { error: updateError } = await supabaseAdmin
          .from('email_verification_requests')
          .update({
            sent_count: recentRequests.sent_count + 1,
            code_hash: codeHash,
            code_expires_at: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000).toISOString(),
            next_allowed_at: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
            status: 'pending',
          })
          .eq('id', recentRequests.id);

        if (updateError) {
          return errorResponseHelper(
            'Database error',
            'DATABASE_ERROR',
            'Error updating verification request',
            updateError,
          );
        }

        if (isDev) {
          console.log('Generated raw code for resending verification email:', rawCode); // Debug log to verify code generation
        }
        await sendVerificationEmail(email, rawCode, full_name);

        return successResponseHelper(
          'A verification code has been sent to your email. Please check your inbox.',
        );
      }

      // resend verification email if no email-based rate record exists.
      if (!recentRequests) {
        const rawCode = generateUniqueCode();
        const newHashedCode = await hashString(rawCode);
        const { error: insertRequestError } = await supabaseAdmin
          .from('email_verification_requests')
          .insert({
            email,
            purpose: 'account_registration',
            code_hash: newHashedCode,
            sent_count: 1,
            code_expires_at: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000),
            next_allowed_at: new Date(now.getTime() + cooldownMinutes * 60 * 1000),
            window_started_at: now,
            window_expires_at: new Date(now.getTime() + windowMinutes * 60 * 1000),
          })
          .select('id')
          .single();

        if (insertRequestError) {
          managerLogs.error(
            `Database error while creating verification request for email: ${email}`,
            {
              full_name,
              phone: maskPhone(phone),
              error: insertRequestError,
            },
          );
          return errorResponseHelper(
            'Database error',
            'DATABASE_ERROR',
            'Error creating verification request record',
            insertRequestError,
          );
        }

        if (isDev) {
          console.log('Generated raw code for new manager:', rawCode); // Debug log to verify code generation
        }
        await sendVerificationEmail(email, rawCode, full_name);

        managerLogs.info(
          `Sent first verification email for unverified existing manager with email: ${email}`,
          {
            full_name,
            phone: maskPhone(phone),
            sent_count: 1,
          },
        );
        return successResponseHelper(
          'A verification code has been sent to your email. Please check your inbox.',
        );
      }
    }

    // 4. Create new manager account
    const passwordHash = await hashString(password);
    const { error: insertError } = await supabaseAdmin
      .from('managers')
      .insert({
        email,
        full_name,
        phone,
        password_hash: passwordHash,
      })
      .select('id')
      .single();

    if (insertError) {
      managerLogs.error(`Database error while creating manager for email: ${email}`, {
        full_name,
        phone: maskPhone(phone),
        error: insertError,
      });
      return errorResponseHelper(
        'Database error',
        'DATABASE_ERROR',
        'Error inserting new manager into database',
        insertError,
      );
    }

    // 5. Generate and store hashed verification code with expiry.
    const rawCode = generateUniqueCode();
    const codeHash = await hashString(rawCode);
    const codeExpiry = new Date(now.getTime() + codeExpiryMinutes * 60 * 1000);
    const { error: codeInsertError } = await supabaseAdmin
      .from('email_verification_requests')
      .insert({
        email,
        purpose: 'account_registration',
        code_hash: codeHash,
        code_expires_at: codeExpiry,
        status: 'pending',
        sent_count: 1,
        next_allowed_at: new Date(now.getTime() + cooldownMinutes * 60 * 1000),
        window_started_at: now,
        window_expires_at: new Date(now.getTime() + windowMinutes * 60 * 1000),
      })
      .select('id')
      .single();

    if (codeInsertError) {
      managerLogs.error(`Database error while creating verification code for email: ${email}`, {
        full_name,
        phone: maskPhone(phone),
        error: codeInsertError,
      });

      const { error: deleteManagerError } = await supabaseAdmin
        .from('managers')
        .delete()
        .eq('email', email)
        .eq('is_verified', false);

      if (deleteManagerError) {
        managerLogs.error(`Database error while deleting unverified manager for email: ${email}`, {
          full_name,
          phone: maskPhone(phone),
          error: deleteManagerError,
        });
      }

      return errorResponseHelper(
        'Database error',
        'DATABASE_ERROR',
        'Error inserting verification code into database',
        codeInsertError,
      );
    }

    // 6. Send verification email
    managerLogs.info(`Sending verification email for new manager with email: ${email}`, {
      full_name,
      phone: maskPhone(phone),
    });
    if (isDev) {
      console.log('Generated raw code for new manager:', rawCode); // Debug log to verify code generation
    }
    await sendVerificationEmail(email, rawCode, full_name);

    // 7. Return generic success response
    return successResponseHelper(
      'Manager account created successfully. Please check your email to verify your account.',
    );
  } catch (error) {
    if (isDev) {
      console.error('CreateManagerService error:', error);
    }

    if (error instanceof ZodError) {
      return errorResponseHelper(
        'Validation error',
        'VALIDATION_ERROR',
        'Manager data validation error',
        error,
      );
    }

    return errorResponseHelper(
      'Internal server error',
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred while creating the manager account',
      error,
    );
  }
};

export default CreateManagerService;
