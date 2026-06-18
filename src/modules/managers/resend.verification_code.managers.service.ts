// Resend Verification Code Manager Service
/**
 * This service is responsible for handling the logic related to resending verification codes to users. It interacts with the database to find the user and updates the verification code as needed. It also handles sending the new verification code to the user's email or phone number.
 * The service includes methods for:
 * - Finding the user by their email or phone number.
 * - Generating a new verification code.
 * - Sending the new verification code to the user.
 */

import { ResendVerificationCodeData, ResendVerificationCodeDataSchema } from './managers.types.js';
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
import db from '../../db/index.js';
import { managers } from '../../db/schema/managers.js';
import { eq, and, desc } from 'drizzle-orm';
import { emailVerificationRequests } from '../../db/schema/emailVerificationRequests.js';

/*
#Plan:
1. Accept and validate the email for the request
2. Find the user in the database using the provided email
3: If the user is not found or already verified, return a success response
4. If the user is found, generate a new verification code
5: Update the user's emailVerificationRequests record in the database with the new verification code
6. Send the new verification code to the user's email
7. Return a success response indicating that the verification code has been resent
*/

const ResendVerificationCodeManagerService = async (email: ResendVerificationCodeData) => {
  const now = new Date();
  const { cooldownMinutes, windowMinutes, maxSendsPerWindow, codeExpiryMinutes } =
    userAccountSettings();

  const managerLogs = logger.child({
    service: 'ResendVerificationCodeManagerService',
    requestId: randomUUID(),
  });

  let userEmail: string | undefined;
  try {
    // Step 1: Accept and validate the email for the request
    const parsed = ResendVerificationCodeDataSchema.parse(email);
    userEmail = parsed.email;

    // Step 2: Find the user in the database using the provided email
    const manager = await db
      .select({
        id: managers.id,
        email: managers.email,
        fullName: managers.fullName,
        isVerified: managers.isVerified,
      })
      .from(managers)
      .where(eq(managers.email, userEmail))
      .limit(1);

    const user = manager[0];
    if (!user) {
      // Step 3: If the user is not found or already verified, return a success response
      managerLogs.warn('Verification resend requested for non-existing manager.', {
        email: redactEmailUsername(userEmail),
      });
      return successResponseHelper(
        'If this account requires verification, a verification code has been sent.',
      );
    }

    if (user.isVerified) {
      return successResponseHelper(
        'If this account requires verification, a verification code has been sent.',
      );
    }

    // Step 4: If the user is found, generate a new verification code
    const newVerificationCode = generateUniqueCode();
    const hashedVerificationCode = await hashString(newVerificationCode);

    // Step 5: Update the user's emailVerificationRequests record in the database with the new verification code
    const request = await db
      .select({
        id: emailVerificationRequests.id,
        sentCount: emailVerificationRequests.sentCount,
        windowStartedAt: emailVerificationRequests.windowStartedAt,
        windowExpiresAt: emailVerificationRequests.windowExpiresAt,
        nextAllowedAt: emailVerificationRequests.nextAllowedAt,
      })
      .from(emailVerificationRequests)
      .orderBy(desc(emailVerificationRequests.createdAt))
      .where(
        and(
          eq(emailVerificationRequests.email, userEmail),
          eq(emailVerificationRequests.purpose, 'account_registration'),
          eq(emailVerificationRequests.status, 'pending'),
        ),
      )
      .limit(1);

    const existingRequest = request[0];
    if (existingRequest) {
      const {
        sentCount,
        windowStartedAt,
        windowExpiresAt: WindowWillExpireAt,
        nextAllowedAt,
      } = existingRequest;

      if (
        sentCount &&
        WindowWillExpireAt &&
        sentCount >= maxSendsPerWindow &&
        now < new Date(WindowWillExpireAt)
      ) {
        managerLogs.warn(
          `Maximum resend attempts reached for email: ${redactEmailUsername(userEmail)}. Sent count: ${sentCount}, Window expires at: ${WindowWillExpireAt}`,
        );
        return errorResponseHelper(
          'Maximum resend attempts reached. Please try again later.',
          'MAX_ATTEMPTS_REACHED',
          'Maximum resend attempts reached. Please try again later.',
        );
      }

      if (nextAllowedAt && now < new Date(nextAllowedAt)) {
        managerLogs.warn(
          `Cooldown active for email: ${redactEmailUsername(userEmail)}. Next allowed at: ${nextAllowedAt}`,
        );
        return errorResponseHelper(
          `Please wait before requesting another code.`,
          'COOLDOWN_ACTIVE',
          `Please wait before requesting another code.`,
        );
      }

      const windowExpiresAt = WindowWillExpireAt ? new Date(WindowWillExpireAt) : null;
      const isWindowExpired = !windowExpiresAt || now >= windowExpiresAt;
      const nextSentCount = isWindowExpired ? 1 : (sentCount ?? 0) + 1;
      const nextWindowStartedAt = isWindowExpired ? now.toISOString() : windowStartedAt;
      const nextWindowExpiresAt = isWindowExpired
        ? new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString()
        : WindowWillExpireAt;

      await db
        .update(emailVerificationRequests)
        .set({
          codeHash: hashedVerificationCode,
          sentCount: nextSentCount,
          lastSentAt: now.toISOString(),
          nextAllowedAt: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
          windowStartedAt: nextWindowStartedAt,
          windowExpiresAt: nextWindowExpiresAt,
          codeExpiresAt: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000).toISOString(),
        })
        .where(eq(emailVerificationRequests.id, existingRequest.id));

      // Step 6: Send the new verification code to the user's email
      managerLogs.info(
        `Updated existing verification request and sent email for email: ${redactEmailUsername(userEmail)}`,
      );
      await sendVerificationEmail(userEmail, newVerificationCode, user.fullName ?? '');

      // Step 7: Return a success response indicating that the verification code has been resent
      managerLogs.info(
        'Verification code resent successfully to email', {
          email: redactEmailUsername(userEmail)
        }
      );
      return successResponseHelper('If this account requires verification, a verification code has been sent.', { 
        email: userEmail 
      });
    } else {
      await db.insert(emailVerificationRequests).values({
        email: userEmail,
        codeHash: hashedVerificationCode,
        purpose: 'account_registration',
        sentCount: 1,
        lastSentAt: now.toISOString(),
        nextAllowedAt: new Date(now.getTime() + cooldownMinutes * 60 * 1000).toISOString(),
        windowStartedAt: now.toISOString(),
        windowExpiresAt: new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString(),
        codeExpiresAt: new Date(now.getTime() + codeExpiryMinutes * 60 * 1000).toISOString(),
        status: 'pending',
      });

      // Step 6: Send the new verification code to the user's email
      managerLogs.info(
        `Created new verification request and sent email for email: ${redactEmailUsername(userEmail)}`,
      );
      await sendVerificationEmail(userEmail, newVerificationCode, user.fullName ?? '');

      // Step 7: Return a success response indicating that the verification code has been resent
      managerLogs.info(
        `Verification code sent successfully to email: ${redactEmailUsername(userEmail)}`,
      );
      return successResponseHelper('If this account requires verification, a verification code has been sent.', { email: userEmail });
    }
  } catch (error) {
    managerLogs.error('An unexpected error occurred while resending verification code.', {
      email: userEmail ?  redactEmailUsername(userEmail) : undefined,
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
