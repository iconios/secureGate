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
import { compareString, hashString } from '../../utils/hashHelper.js';
import sendPasswordUpdateSuccessfulEmail from '../../common/postmark/successPasswordUpdateEmail.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';
import db from '../../db/index.js';
import { emailVerificationRequests } from '../../db/schema/emailVerificationRequests.js';
import { and, eq, ne } from 'drizzle-orm';
import { managers } from '../../db/schema/managers.js';

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
   - Ensure new password is not the same with previous password
4. Validate the token:
   - token hash matches the stored code_hash
   - code_expires_at is greater than the current time
5. If the token is invalid or expired:
   - return an invalid or expired token response
   - if expired, optionally mark the reset request as expired
6. Hash the new password securely.
7. Call transaction to:
   - update the manager/user password
   - mark the current password reset request as used
   - revoke any other pending password_reset requests for the same manager/user
8. Send password reset success email to the user.
9. Return a success response.
*/

class UpdateManagerPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpdateManagerPasswordError';
  }
}

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
    const [pendingRequestData] = await db
      .select({
        id: emailVerificationRequests.id,
        codeHash: emailVerificationRequests.codeHash,
        codeExpiresAt: emailVerificationRequests.codeExpiresAt,
        email: emailVerificationRequests.email,
      })
      .from(emailVerificationRequests)
      .where(
        and(
          eq(emailVerificationRequests.status, 'pending'),
          eq(emailVerificationRequests.purpose, 'password_reset'),
          eq(emailVerificationRequests.id, request_id),
        ),
      )
      .limit(1);

    if (!pendingRequestData) {
      managerLogs.warn('Invalid or missing password reset request');

      return errorResponseHelper(
        'Invalid or expired token',
        'INVALID_OR_EXPIRED_TOKEN',
        'Invalid or expired token',
      );
    }

    emailInProcess = pendingRequestData.email;

    // Step 3. Get the manager/user email from the password reset request record
    const [userData] = await db
      .select({
        id: managers.id,
        email: managers.email,
        fullName: managers.fullName,
        passwordHash: managers.passwordHash,
      })
      .from(managers)
      .where(eq(managers.email, pendingRequestData.email))
      .limit(1);

    if (!userData) {
      managerLogs.warn('Error fetching user data', {
        email: redactEmailUsername(pendingRequestData.email),
      });
      return errorResponseHelper(
        'Invalid or expired token',
        'INVALID_OR_EXPIRED_TOKEN',
        'Invalid or expired token',
      );
    }

    // Ensure new password is not the same with previous password
    const isSamePassword = await compareString(password, userData.passwordHash ?? '');
    if (isSamePassword) {
      managerLogs.warn('New password must be different from the current password', {
        email: redactEmailUsername(pendingRequestData.email),
      });
      return errorResponseHelper(
        'New password must be different from the current password',
        'PASSWORD_REUSE_NOT_ALLOWED',
        'New password must be different from the current password',
      );
    }

    // Step 4. Validate the token
    const isTokenMatch = await compareString(token, pendingRequestData.codeHash ?? '');
    // 5. If the token is invalid, return an invalid or expired token response
    if (!isTokenMatch) {
      managerLogs.warn('Invalid password reset token', {
        email: redactEmailUsername(pendingRequestData.email),
      });

      return errorResponseHelper(
        'Invalid or expired token',
        'INVALID_OR_EXPIRED_TOKEN',
        'Invalid or expired token',
      );
    }

    if (pendingRequestData.codeExpiresAt && new Date(pendingRequestData.codeExpiresAt) < now) {
      // 5. If the token is expired, mark expired token as expired and return an invalid or expired token response
      managerLogs.warn('Expired password reset token', {
        email: redactEmailUsername(pendingRequestData.email),
      });

      await db
        .update(emailVerificationRequests)
        .set({
          status: 'expired',
        })
        .where(eq(emailVerificationRequests.id, pendingRequestData.id));

      return errorResponseHelper(
        'Invalid or expired token',
        'INVALID_OR_EXPIRED_TOKEN',
        'Invalid or expired token',
      );
    }

    // Step 6. Hash the new password securely
    const passwordHash = await hashString(password);

    // Step 7. Call transaction to update password + token statuses
    await db.transaction(async (tx) => {
      // 1. Update the manager password
      const [updatedManager] = await tx
        .update(managers)
        .set({
          passwordHash,
        })
        .where(and(eq(managers.id, userData.id), eq(managers.email, userData.email)))
        .returning({
          id: managers.id,
        });

      if (!updatedManager) {
        throw new UpdateManagerPasswordError('Manager password update failed');
      }

      // 2. Mark the current reset request as used
      const [requestData] = await tx
        .update(emailVerificationRequests)
        .set({
          status: 'used',
          usedAt: now.toISOString(),
        })
        .where(
          and(
            eq(emailVerificationRequests.email, userData.email),
            eq(emailVerificationRequests.purpose, 'password_reset'),
            eq(emailVerificationRequests.status, 'pending'),
            eq(emailVerificationRequests.id, pendingRequestData.id),
          ),
        )
        .returning({
          id: emailVerificationRequests.id,
        });

      if (!requestData) {
        throw new UpdateManagerPasswordError('Password reset request update failed');
      }

      // 3. Revoke all other pending password reset requests for same manager/email
      await tx
        .update(emailVerificationRequests)
        .set({
          status: 'revoked',
          usedAt: now.toISOString(),
        })
        .where(
          and(
            eq(emailVerificationRequests.email, userData.email),
            eq(emailVerificationRequests.purpose, 'password_reset'),
            eq(emailVerificationRequests.status, 'pending'),
            ne(emailVerificationRequests.id, pendingRequestData.id),
          ),
        )
        .returning({
          id: emailVerificationRequests.id,
        });
    });

    // Step 8. Send password reset success email to the user
    await sendPasswordUpdateSuccessfulEmail(userData.email, userData.fullName, now);

    // Step 9. Return a success response
    return successResponseHelper('Password update successful');
  } catch (error) {
    if (error instanceof UpdateManagerPasswordError) {
      managerLogs.error(error.message, {
        email: redactEmailUsername(emailInProcess),
        error,
      });
      return errorResponseHelper(error.message, 'UPDATE_MANAGER_PASSWORD_ERROR', error.message);
    }

    if (error instanceof ZodError) {
      managerLogs.error('Invalid input data.', {
        email: redactEmailUsername(emailInProcess),
        error: error.issues,
      });
      return errorResponseHelper(
        'Invalid input data.',
        'BAD_REQUEST',
        'Invalid input data.',
        error,
      );
    }

    const errMessage =
      error instanceof Error ? error.message : 'An error occurred while updating the password';
    managerLogs.error(errMessage, {
      email: redactEmailUsername(emailInProcess),
      message: errMessage,
      error,
    });
    return errorResponseHelper(
      'An unexpected error occurred.',
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred.',
      error,
    );
  }
};

export default UpdatePasswordManagerService;
