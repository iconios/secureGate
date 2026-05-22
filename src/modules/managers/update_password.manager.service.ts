// Update Password Manager Service
/*
#Plan:
1. Accept and validate the update data (email, new_password, password reset token)
2. Check if manager is in the database and verified
3. Check if the password reset token matches the manager and is valid
4. Update the manager new_password
5. Delete the password reset token record
6. Send successful password change email to manager
7. Send appropriate response to the manager
*/

import { ZodError } from 'zod';
import { supabaseAdmin } from '../../common/supabase/supabase';
import { errorResponseHelper } from '../../utils/errorResponseHelper';
import { compareString, hashString } from '../../utils/hashHelper';
import { PasswordUpdateData, PasswordUpdateDataSchema } from './managers.types';
import logger from '../../common/winston/logger';
import { randomUUID } from 'crypto';
import { redactEmailUsername } from '../../utils/redactEmailUsername';
import { successResponseHelper } from '../../utils/successResponseHelper';

const UpdatePasswordManagerService = async (updateData: PasswordUpdateData) => {
  const now = new Date();

  const managerLogs = logger.child({
    service: 'UpdatePasswordManagerService',
    requestId: randomUUID(),
  });

  try {
    // Step 1. Accept and validate the update data (email, new_password, password reset token)
    const { email, password, token } = PasswordUpdateDataSchema.parse(updateData);

    // Step 2. Check if manager is in the database and verified
    const { data: manager, error: selectError } = await supabaseAdmin
      .from('managers')
      .select('id, email, is_verified')
      .eq('email', email)
      .eq('is_verified', true)
      .maybeSingle();

    if (selectError) {
      managerLogs.error(
        `Database error when selecting manager record for ${redactEmailUsername(email)}`,
        {
          error: selectError,
        },
      );

      return errorResponseHelper(
        'Database error when selecting manager record',
        'USER_NOT_FOUND',
        'Database error when selecting manager record',
        { error: selectError ?? '' },
      );
    }

    // Step 3. Check if the password reset token matches the manager and is valid
    const { data: existingRequest, error: fetchError } = await supabaseAdmin
      .from('email_verification_requests')
      .select('id, code_hash')
      .eq('purpose', 'password_reset')
      .eq('email', manager?.email)
      .gte('code_expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      managerLogs.error(
        `Error fetching password reset exisiting request for ${redactEmailUsername(email)}`,
        {
          error: fetchError,
        },
      );

      return errorResponseHelper(
        'Error fetching password reset exisiting request',
        'DATABASE_ERROR',
        'Error fetching password reset exisiting request',
        fetchError,
      );
    }

    if (!existingRequest) {
      managerLogs.warn(`Invalid or expired request for ${redactEmailUsername(email)}`);

      return errorResponseHelper(
        'Invalid or expired request',
        'INVALID_REQUEST',
        'Invalid or expired request',
      );
    }

    const isTokenMatch = await compareString(token, existingRequest.code_hash);
    if (!isTokenMatch) {
      managerLogs.warn(`Invalid or expired request for ${redactEmailUsername(email)}`);

      return errorResponseHelper(
        'Invalid or expired request',
        'INVALID_REQUEST',
        'Invalid or expired request',
      );
    }

    // Step 4. Update the manager new_password
    const password_hash = await hashString(password);
    const { error: updateError } = await supabaseAdmin
      .from('managers')
      .update({
        password_hash,
      })
      .eq('id', manager?.id)
      .eq('email', email);

    if (updateError) {
      managerLogs.error(`Error updating password for ${redactEmailUsername(email)}`, {
        error: updateError,
      });

      return errorResponseHelper(
        'Error updating password',
        'DATABASE_ERROR',
        'Error updating password',
        updateError,
      );
    }

    // Step 5. Delete the password reset token record
    const { error: deleteError } = await supabaseAdmin
      .from('email_verification_requests')
      .delete()
      .eq('id', existingRequest.id);

    if (deleteError) {
      managerLogs.error(
        `Error removing used password request record for ${redactEmailUsername(email)}`,
        {
          error: deleteError,
        },
      );

      return errorResponseHelper(
        'Error removing used password request record',
        'DATABASE_ERROR',
        'Error removing used password request record',
        deleteError,
      );
    }

    // Step 6. Send successful password change email to manager
    // await sendSuccessfulPasswordChangeEmail()

    // Step 7. Send appropriate response to the manager
    return successResponseHelper('Password change successfully changed', { email });
  } catch (error) {
    managerLogs.error('An unexpected error occurred while updating manager password', {
      error,
    });

    if (error instanceof ZodError) {
      managerLogs.error('Invalid input data', {
        error,
      });

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
