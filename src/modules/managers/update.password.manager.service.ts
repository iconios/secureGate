// Update Password Manager Service
/**
 * The Update Password Manager Service is responsible for securely completing the manager
 * password reset process after a valid reset token has been issued.
 * Its main purpose is to accept the manager’s reset token and new password, verify that
 * the token is still valid, and safely update the manager’s password in the database.
 */

import { ZodError } from 'zod';
import { PasswordUpdateData, PasswordUpdateDataSchema } from './managers.types';
import { errorResponseHelper } from '../../utils/errorResponseHelper';

/*
#Plan:
1. Accept and validate the update password data:
   - email or user id
   - token
   - new password
2. Validate that the new password meets password security requirements.
3. Find the manager/user by email or user id.
4. Find the latest pending password_reset request for that manager/user.
5. Validate the token:
   - request exists
   - purpose is password_reset
   - status is pending
   - token hash matches the stored code_hash
   - code_expires_at is greater than the current time
6. If the token is invalid or expired:
   - return an invalid or expired token response
   - optionally mark expired token as expired
7. Hash the new password securely.
8. Update the manager/user password in the database.
9. Mark the current password reset request as used.
10. Revoke any other pending password_reset requests for the same manager/user.
11. Send password reset success email to the user.
12. Return a success response.
*/

const UpdatePasswordManagerService = async (passwordUpdateData: PasswordUpdateData) => {
  try {
    // Step 1. Accept and validate the update password data
    const { email, password, token } = PasswordUpdateDataSchema.parse(passwordUpdateData);
  } catch (error) {
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
