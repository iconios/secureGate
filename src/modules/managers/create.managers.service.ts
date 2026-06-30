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
4. Call transaction:
    Generate and store hashed verification code with expiry in database.
    Create new manager account
5. Send verification email
6. Return generic success response
*/

import { ZodError } from 'zod';
import { userAccountSettings } from '../../common/configs.js';
import sendVerificationEmail from '../../common/postmark/verificationEmail.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { hashString } from '../../utils/hashHelper.js';
import { NewManagerData, NewManagerDataSchema } from './managers.types.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { maskPhone } from '../../utils/maskPhoneHelper.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { generateUniqueCode } from '../../utils/codeGenHelper.js';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';
import db from '../../db/index.js';
import { managers } from '../../db/schema/managers.js';
import { and, desc, eq } from 'drizzle-orm';
import { emailVerificationRequests } from '../../db/schema/emailVerificationRequests.js';

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

    const [existingManager] = await db
      .select({
        isVerified: managers.isVerified,
      })
      .from(managers)
      .where(eq(managers.email, email))
      .limit(1);

    if (existingManager?.isVerified === true) {
      // Log the attempt and outcome
      managerLogs.warn('Manager account already exists for new manager creation request', {
        email: redactEmailUsername(email),
        full_name,
        phone: maskPhone(phone),
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

    if (
      existingManager &&
      (existingManager.isVerified === false || existingManager.isVerified === null)
    ) {
      // apply email-based rate limit / reset cooldown
      const [recentRequests] = await db
        .select({
          id: emailVerificationRequests.id,
          nextAllowedAt: emailVerificationRequests.nextAllowedAt,
          windowExpiresAt: emailVerificationRequests.windowExpiresAt,
          sentCount: emailVerificationRequests.sentCount,
        })
        .from(emailVerificationRequests)
        .where(
          and(
            eq(emailVerificationRequests.email, email),
            eq(emailVerificationRequests.purpose, 'account_registration'),
            eq(emailVerificationRequests.status, 'pending'),
          ),
        )
        .orderBy(desc(emailVerificationRequests.createdAt))
        .limit(1);

      // don't resend verification email if window disallows and max sends reached.
      const windowExpiresAt = recentRequests?.windowExpiresAt
        ? new Date(recentRequests.windowExpiresAt)
        : null;
      const nextAllowedAt = recentRequests?.nextAllowedAt
        ? new Date(recentRequests.nextAllowedAt)
        : null;
      const safeSentCount = recentRequests?.sentCount ?? 0;
      if (windowExpiresAt && windowExpiresAt > now && safeSentCount >= maxSendsPerWindow) {
        managerLogs.warn('Verification email resend attempt exceeding window limit for email', {
          email: redactEmailUsername(email),
          full_name,
          phone: maskPhone(phone),
          sent_count: recentRequests?.sentCount,
          window_expires_at: recentRequests?.windowExpiresAt,
        });
        return errorResponseHelper(
          'Too many attempts',
          'TOO_MANY_ATTEMPTS',
          `You have reached the maximum number of verification emails that can be sent in a ${windowMinutes} minute window. Please try again later.`,
        );
      }

      // dont resend verification email if cooldown disallows.
      if (nextAllowedAt && nextAllowedAt > now) {
        managerLogs.warn('Verification email resend attempt during cooldown for email', {
          email: redactEmailUsername(email),
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
      if (recentRequests && (!windowExpiresAt || windowExpiresAt <= now)) {
        const rawCode = generateUniqueCode();
        const newHashedCode = await hashString(rawCode);
        const [updatedRequest] = await db
          .update(emailVerificationRequests)
          .set({
            sentCount: 1,
            codeHash: newHashedCode,
            codeExpiresAt: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000).toISOString(),
            nextAllowedAt: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
            windowStartedAt: now.toISOString(),
            windowExpiresAt: new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString(),
            status: 'pending',
          })
          .where(eq(emailVerificationRequests.id, recentRequests.id))
          .returning({
            id: emailVerificationRequests.id,
          });

        if (!updatedRequest) {
          managerLogs.warn('Unable to update verification request while creating manager account', {
            email: redactEmailUsername(email),
            phone: maskPhone(phone),
          });
          return errorResponseHelper(
            'Unable to resend verification email',
            'VERIFICATION_REQUEST_UPDATE_FAILED',
            'Unable to resend verification email. Please try again later.',
          );
        }

        if (isDev) {
          console.log('Generated raw code for resending verification email:', rawCode); // Debug log to verify code generation
        }
        await sendVerificationEmail(email, rawCode, full_name);

        managerLogs.info('Resent verification email during new window for email', {
          email: redactEmailUsername(email),
          full_name,
          phone: maskPhone(phone),
          sent_count: 1,
        });
        return successResponseHelper(
          'A new verification code has been sent to your email. Please check your inbox.',
        );
      }

      // resend verification email if recent request exists, window not expired, sent_count below max, and cooldown has passed
      if (
        recentRequests &&
        windowExpiresAt &&
        windowExpiresAt > now &&
        (!nextAllowedAt || nextAllowedAt <= now) &&
        safeSentCount < maxSendsPerWindow
      ) {
        const rawCode = generateUniqueCode();
        const codeHash = await hashString(rawCode);

        await db
          .update(emailVerificationRequests)
          .set({
            sentCount: safeSentCount + 1,
            codeHash: codeHash,
            codeExpiresAt: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000).toISOString(),
            nextAllowedAt: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
            status: 'pending',
          })
          .where(eq(emailVerificationRequests.id, recentRequests.id));

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
        await db.insert(emailVerificationRequests).values({
          email,
          purpose: 'account_registration',
          codeHash: newHashedCode,
          sentCount: 1,
          codeExpiresAt: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000).toISOString(),
          nextAllowedAt: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
          windowStartedAt: now.toISOString(),
          windowExpiresAt: new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString(),
        });

        if (isDev) {
          console.log('Generated raw code for new manager:', rawCode); // Debug log to verify code generation
        }
        await sendVerificationEmail(email, rawCode, full_name);

        managerLogs.info(
          'Sent first verification email for unverified existing manager with email',
          {
            email: redactEmailUsername(email),
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

    // 4. Call transaction:
    // Generate and store hashed verification code with expiry in database.
    // Create new manager account
    const passwordHash = await hashString(password);
    const rawCode = generateUniqueCode();
    const codeHash = await hashString(rawCode);
    const codeExpiry = new Date(now.getTime() + codeExpiryMinutes * 60 * 1000);

    await db.transaction(async (tx) => {
      await tx.insert(managers).values({
        email,
        fullName: full_name,
        phone,
        passwordHash,
        isVerified: false,
      });

      await tx.insert(emailVerificationRequests).values({
        email,
        purpose: 'account_registration',
        codeHash,
        codeExpiresAt: codeExpiry.toISOString(),
        status: 'pending',
        sentCount: 1,
        nextAllowedAt: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
        windowStartedAt: now.toISOString(),
        windowExpiresAt: new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString(),
      });
    });

    // 5. Send verification email
    managerLogs.info('Sending verification email for new manager with email', {
      email: redactEmailUsername(email),
      full_name,
      phone: maskPhone(phone),
    });
    if (isDev) {
      console.log('Generated raw code for new manager:', rawCode); // Debug log to verify code generation
    }

    const emailSentResult = await sendVerificationEmail(email, rawCode, full_name);
    if (!emailSentResult.success) {
      managerLogs.error('Manager created but verification email failed to send', {
        email: redactEmailUsername(email),
        full_name,
        phone: maskPhone(phone),
      });

      return errorResponseHelper(
        'Unable to send verification email',
        'VERIFICATION_EMAIL_SEND_FAILED',
        'Your account was created, but we could not send the verification email. Please try resending the verification code.',
      );
    }

    // 6. Return generic success response
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
