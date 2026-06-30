// Forgot Password Manager Service
/**
 * This service is responsible for handling the logic related to the forgot password functionality for managers. It interacts with the database to find the user and updates the password reset code as needed. It also handles sending the password reset code to the user's email.
 * The service includes methods for:
 * - Finding the user by their email.
 * - Generating a new password reset code.
 * - Sending the password reset code to the user's email.
 */

import { randomUUID } from 'crypto';
import logger from '../../common/winston/logger.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { hashString } from '../../utils/hashHelper.js';
import { tokenGenHelper } from '../../utils/tokenGenHelper.js';
import { ForgotPasswordData, ForgotPasswordDataSchema } from './managers.types.js';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';
import { userAccountSettings } from '../../common/configs.js';
import sendPasswordResetEmail from '../../common/postmark/resetPasswordEmail.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { ZodError } from 'zod';
import db from '../../db/index.js';
import { managers } from '../../db/schema/managers.js';
import { and, desc, eq, ne } from 'drizzle-orm';
import { emailVerificationRequests } from '../../db/schema/emailVerificationRequests.js';

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
    const [user] = await db
      .select({
        id: managers.id,
        email: managers.email,
        fullName: managers.fullName,
      })
      .from(managers)
      .where(eq(managers.email, userEmail))
      .limit(1);

    if (!user) {
      // Step 3: If the user is not found, return an error response
      managerLogs.warn('Password reset user not found', {
        email: redactEmailUsername(userEmail),
      });

      return successResponseHelper(
        'If an account exists for this email, a password reset code has been sent.',
        {
          email: redactEmailUsername(userEmail),
        },
      );
    }

    // Step 4: If the user is found, generate a new password reset code
    const newResetCode = tokenGenHelper();
    const hashedResetCode = await hashString(newResetCode);

    // Step 5: Update the user's record in the database with the new password reset code
    const [existingRequest] = await db
      .select({
        id: emailVerificationRequests.id,
        sentCount: emailVerificationRequests.sentCount,
        windowStartedAt: emailVerificationRequests.windowStartedAt,
        windowExpiresAt: emailVerificationRequests.windowExpiresAt,
        nextAllowedAt: emailVerificationRequests.nextAllowedAt,
      })
      .from(emailVerificationRequests)
      .where(
        and(
          eq(emailVerificationRequests.email, userEmail),
          eq(emailVerificationRequests.purpose, 'password_reset'),
          eq(emailVerificationRequests.status, 'pending'),
        ),
      )
      .orderBy(desc(emailVerificationRequests.createdAt))
      .limit(1);

    if (existingRequest) {
      const {
        sentCount,
        windowStartedAt,
        windowExpiresAt: windowExpiringAt,
        nextAllowedAt,
      } = existingRequest;

      const safeSentCount = sentCount ?? 0;
      const safeWindowStartedAt = windowStartedAt ?? now.toISOString();
      const windowExpiresAt = windowExpiringAt ? new Date(windowExpiringAt) : null;

      const cooldownNextAllowedAt = nextAllowedAt ? new Date(nextAllowedAt) : null;

      if (windowExpiresAt && safeSentCount >= maxSendsPerWindow && now < windowExpiresAt) {
        managerLogs.warn('Maximum resend attempts reached for manager', {
          email: redactEmailUsername(userEmail),
          sentCount: safeSentCount,
          windowExpiresAt,
        });

        return errorResponseHelper(
          'Maximum resend attempts reached. Please try again later.',
          'MAX_ATTEMPTS_REACHED',
          'Maximum resend attempts reached. Please try again later.',
        );
      }

      if (cooldownNextAllowedAt && now < cooldownNextAllowedAt) {
        managerLogs.warn('Cooldown active for manager', {
          email: redactEmailUsername(userEmail),
          nextAllowedAt,
        });

        return errorResponseHelper(
          'Please wait before requesting another code.',
          'COOLDOWN_ACTIVE',
          'Please wait before requesting another code.',
        );
      }

      const isWindowExpired = !windowExpiresAt || now >= windowExpiresAt;
      const nextSentCount = isWindowExpired ? 1 : safeSentCount + 1;

      const nextWindowStartedAt = isWindowExpired ? now.toISOString() : safeWindowStartedAt;

      const nextWindowExpiresAt = isWindowExpired
        ? new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString()
        : windowExpiresAt.toISOString();

      await db.transaction(async (tx) => {
        await tx
          .update(emailVerificationRequests)
          .set({
            status: 'used',
            usedAt: now.toISOString(),
          })
          .where(
            and(
              ne(emailVerificationRequests.id, existingRequest.id),
              eq(emailVerificationRequests.status, 'pending'),
              eq(emailVerificationRequests.purpose, 'password_reset'),
              eq(emailVerificationRequests.email, userEmail),
            ),
          );

        await tx
          .update(emailVerificationRequests)
          .set({
            codeHash: hashedResetCode,
            sentCount: nextSentCount,
            lastSentAt: now.toISOString(),
            nextAllowedAt: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
            windowStartedAt: nextWindowStartedAt,
            windowExpiresAt: nextWindowExpiresAt,
            codeExpiresAt: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000).toISOString(),
          })
          .where(eq(emailVerificationRequests.id, existingRequest.id));
      });

      // Step 6. Send the new password reset code to the user's email
      managerLogs.info('Updated existing password reset request', {
        email: redactEmailUsername(userEmail),
      });

      await sendPasswordResetEmail(userEmail, newResetCode, user.fullName, existingRequest.id);

      // Step 7. Return a success response indicating that the password reset code has been sent
      managerLogs.info('Password reset link resent successfully', {
        email: redactEmailUsername(userEmail),
      });

      return successResponseHelper(
        'If an account exists with this email, a password reset link has been sent',
        {
          email: userEmail,
        },
      );
    } else {
      const [insertData] = await db
        .insert(emailVerificationRequests)
        .values({
          email: userEmail,
          codeHash: hashedResetCode,
          purpose: 'password_reset',
          status: 'pending',
          sentCount: 1,
          lastSentAt: now.toISOString(),
          nextAllowedAt: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
          windowStartedAt: now.toISOString(),
          windowExpiresAt: new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString(),
          codeExpiresAt: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000).toISOString(),
        })
        .returning({
          id: emailVerificationRequests.id,
        });

      if (!insertData) {
        managerLogs.error('Error creating password reset request', {
          email: redactEmailUsername(userEmail),
        });

        return errorResponseHelper(
          'Error creating password reset request.',
          'DATABASE_ERROR',
          'Error creating password reset request.',
        );
      }

      // Step 6. Send the new password reset code to the user's email
      managerLogs.info('Created new password reset request and sent', {
        email: redactEmailUsername(userEmail),
      });

      await sendPasswordResetEmail(userEmail, newResetCode, user.fullName, insertData.id);

      // Step 7. Return a success response indicating that the password reset code has been sent
      managerLogs.info('Password reset link sent successfully', {
        email: redactEmailUsername(userEmail),
      });

      return successResponseHelper(
        'If an account exists with this email, a password reset link has been sent',
        {
          email: userEmail,
        },
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
