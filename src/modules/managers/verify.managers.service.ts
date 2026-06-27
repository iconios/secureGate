// Verify Manager Service
/*
Plan:
1. Accept and validate the verification request (e.g., email, code).
2. Check if the email and code match the records in the database and are still valid (not expired).
3. If valid, run transaction to: 
    update the verification request to 'used'
    update the user's status to "verified" and set verifiedAt time in the database.
4. If invalid, send an appropriate error response (e.g., "Invalid code" or "Code expired").
5. Send a confirmation response back to the client.
*/

import { randomUUID } from 'crypto';
import logger from '../../common/winston/logger.js';
import { VerifyManagerData, verifyManagerDataSchema } from './managers.types.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { compareString } from '../../utils/hashHelper.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { ZodError } from 'zod';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';
import db from '../../db/index.js';
import { emailVerificationRequests } from '../../db/schema/emailVerificationRequests.js';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { managers } from '../../db/schema/managers.js';

class VerificationTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerificationTransactionError';
  }
}

const VerifyManagerService = async (verifyManagerData: VerifyManagerData) => {
  const isDev = process.env.NODE_ENV === 'development';
  const now = new Date().toISOString();
  const managerLogs = logger.child({
    service: 'verifyManagerService',
    requestId: randomUUID(),
  });

  let emailProcessing: string | undefined;
  try {
    // 1. Accept and validate the verification request (e.g., email, code).
    const { email, code } = verifyManagerDataSchema.parse(verifyManagerData);
    managerLogs.info('Processing verification request', {
      email: redactEmailUsername(email),
    });
    emailProcessing = email; // Assigning email to the outer scope variable for logging in catch block

    // 2. Check if the email and code match the records in the database and are still valid (not expired).
    const [verificationRequest] = await db
      .select({
        id: emailVerificationRequests.id,
        email: emailVerificationRequests.email,
        purpose: emailVerificationRequests.purpose,
        codeHash: emailVerificationRequests.codeHash,
        status: emailVerificationRequests.status,
        codeExpiresAt: emailVerificationRequests.codeExpiresAt,
      })
      .from(emailVerificationRequests)
      .where(
        and(
          eq(emailVerificationRequests.email, email),
          eq(emailVerificationRequests.purpose, 'account_registration'),
          eq(emailVerificationRequests.status, 'pending'),
          gt(emailVerificationRequests.codeExpiresAt, now),
        ),
      )
      .orderBy(desc(emailVerificationRequests.createdAt))
      .limit(1);

    if (!verificationRequest) {
      managerLogs.error('Verification request not found or expired', {
        email: redactEmailUsername(email),
      });

      return errorResponseHelper(
        'Invalid or expired verification code',
        'VERIFICATION_ERROR',
        'Invalid or expired verification code',
      );
    }

    // 3. If valid, run transaction to:
    //    - update the verification request to 'used'
    //    - update the user's status to "verified" and set verifiedAt time in the database
    if (!verificationRequest.codeHash) {
      managerLogs.error('Verification request has no code hash', {
        email: redactEmailUsername(email),
        verificationRequestId: verificationRequest.id,
      });

      return errorResponseHelper(
        'Invalid or expired verification code',
        'VERIFICATION_ERROR',
        'Invalid or expired verification code',
      );
    }

    const isCodeMatch = await compareString(code, verificationRequest.codeHash);
    if (isCodeMatch) {
      managerLogs.info('Verification code validated successfully', {
        email: redactEmailUsername(email),
      });

      await db.transaction(async (tx) => {
        const transactionNow = new Date().toISOString();

        const [updatedRequest] = await tx
          .update(emailVerificationRequests)
          .set({
            status: 'used',
            usedAt: transactionNow,
          })
          .where(
            and(
              eq(emailVerificationRequests.id, verificationRequest.id),
              eq(emailVerificationRequests.status, 'pending'),
              gt(emailVerificationRequests.codeExpiresAt, transactionNow),
            ),
          )
          .returning({
            id: emailVerificationRequests.id,
          });

        if (!updatedRequest) {
          throw new VerificationTransactionError('Verification request already used or expired');
        }

        const [updatedManager] = await tx
          .update(managers)
          .set({
            isVerified: true,
            verifiedAt: transactionNow,
          })
          .where(
            and(
              eq(managers.email, email),
              or(eq(managers.isVerified, false), isNull(managers.isVerified)),
            ),
          )
          .returning({
            id: managers.id,
            email: managers.email,
            fullName: managers.fullName,
          });

        if (!updatedManager) {
          throw new VerificationTransactionError('Manager not found or already verified');
        }

        return updatedManager;
      });

      // 4. If invalid, send an appropriate error response (e.g., "Invalid code" or "Code expired").
    } else {
      managerLogs.error('Invalid verification code', {
        email: redactEmailUsername(email),
      });

      return errorResponseHelper(
        'Invalid verification code',
        'VERIFICATION_ERROR',
        'Invalid verification code',
        null,
      );
    }

    // 5. Send a confirmation response back to the client.
    managerLogs.info('Manager email verified successfully', {
      email: redactEmailUsername(email),
    });

    return successResponseHelper('Manager email verified successfully', { email });
  } catch (error) {
    if (isDev) {
      console.error('VerifyManagerService:', error);
    }

    if (error instanceof VerificationTransactionError) {
      managerLogs.warn(error.message, {
        email: redactEmailUsername(emailProcessing ?? 'unknownemail@unknown.com'),
      });

      return errorResponseHelper(error.message, 'VERIFICATION_ERROR', error.message);
    }

    if (error instanceof ZodError) {
      managerLogs.warn('Invalid input data during manager verification', {
        email: redactEmailUsername(emailProcessing ?? 'unknownemail@unknown.com'),
        error,
      });

      return errorResponseHelper(
        'Invalid input data',
        'VALIDATION_ERROR',
        'Invalid input data',
        error,
      );
    }

    managerLogs.error('Unexpected error occurred during verification', {
      email: redactEmailUsername(emailProcessing ?? 'unknownemail@unknown.com'),
      error,
    });

    return errorResponseHelper(
      'An unexpected error occurred during verification',
      'VERIFICATION_ERROR',
      'An unexpected error occurred during verification',
      error,
    );
  }
};

export default VerifyManagerService;
