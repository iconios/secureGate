// Verify Manager Service
/*
Plan:
1. Accept and validate the verification request (e.g., email, code).
2. Check if the email and code match the records in the database and are still valid (not expired).
3. If valid, update the user's status to "verified" in the database.
4. If invalid, send an appropriate error response (e.g., "Invalid code" or "Code expired").
5. Send a confirmation response back to the client.
*/

import { randomUUID } from 'crypto';
import logger from '../../common/winston/logger';
import { VerifyManagerData, verifyManagerDataSchema } from './managers.types';
import { supabaseAdmin } from '../../common/supabase/supabase';
import { errorResponseHelper } from '../../utils/errorResponseHelper';
import { compareString } from '../../utils/hashHelper';
import { successResponseHelper } from '../../utils/successResponseHelper';
import { ZodError } from 'zod';
import { redactEmailUsername } from '../../utils/redactEmailUsername';

const VerifyManagerService = async (verifyManagerData: VerifyManagerData) => {
  const isDev = process.env.NODE_ENV === 'development';
  const now = new Date().toISOString();
  const managerLogs = logger.child({
    service: 'verifyManagerService',
    requestId: randomUUID(),
  });

  let emailprocessing: string | undefined;
  try {
    // 1. Accept and validate the verification request (e.g., email, code).
    const { email, code } = verifyManagerDataSchema.parse(verifyManagerData);
    managerLogs.info('Processing verification request', { 
      email: redactEmailUsername(email) 
    });
    emailprocessing = email; // Assigning email to the outer scope variable for logging in catch block

    // 2. Check if the email and code match the records in the database and are still valid (not expired).
    const { data: verificationRequest, error: verificationError } = await supabaseAdmin
      .from('email_verification_requests')
      .select('id, email, purpose, code_hash, status, code_expires_at')
      .eq('email', email)
      .eq('purpose', 'account_registration')
      .eq('status', 'pending')
      .gt('code_expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verificationError || !verificationRequest) {
      managerLogs.error('Verification request not found or expired', {
        email: redactEmailUsername(email),
        error: verificationError ?? null,
      });

      return errorResponseHelper(
        'Invalid or expired verification code',
        'VERIFICATION_ERROR',
        'Invalid or expired verification code',
        verificationError,
      );
    }

    // 3. If valid, update the user's status to "verified" in the database.
    if (verificationRequest.code_hash) {
      const isCodeMatch = await compareString(code, verificationRequest.code_hash);
      if (isCodeMatch) {
        managerLogs.info('Verification code validated successfully', { 
          email: redactEmailUsername(email) 
        });

        const { data: updatedManager, error: updateManagerError } = await supabaseAdmin
          .from('managers')
          .update({
            is_verified: true,
            verified_at: now,
          })
          .eq('email', email)
          .eq('is_verified', false)
          .select('id, email, full_name')
          .maybeSingle();

        if (updateManagerError || !updatedManager) {
          managerLogs.error('Failed to update manager verification status', {
            email: redactEmailUsername(email),
            error: updateManagerError,
          });

          return errorResponseHelper(
            'Failed to update manager verification status',
            'VERIFICATION_ERROR',
            'Failed to update manager verification status',
            updateManagerError,
          );
        }

        const { error: updateRequestError } = await supabaseAdmin
          .from('email_verification_requests')
          .update({
            status: 'used',
            used_at: now,
          })
          .eq('id', verificationRequest.id)
          .eq('status', 'pending');

        if (updateRequestError) {
          managerLogs.error('Failed to update verification request status', {
            email: redactEmailUsername(email),
            error: updateRequestError,
          });

          return errorResponseHelper(
            'Failed to update verification request status',
            'VERIFICATION_ERROR',
            'Failed to update verification request status',
            updateRequestError,
          );
        }

        // 4. If invalid, send an appropriate error response (e.g., "Invalid code" or "Code expired").
      } else {
        managerLogs.error('Invalid verification code', { 
          email: redactEmailUsername(email) 
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
    }
  } catch (error) {
    if (isDev) {
      console.error('VerifyManagerService:', error);
    }
    managerLogs.error('Unexpected error occurred during verification', { 
      email: redactEmailUsername(emailprocessing ?? 'unknownemail@unknown.com'),
      error 
    });

    if (error instanceof ZodError) {
      return errorResponseHelper(
        'Invalid input data',
        'VALIDATION_ERROR',
        'Invalid input data',
        error,
      );
    }

    return errorResponseHelper(
      'An unexpected error occurred during verification',
      'VERIFICATION_ERROR',
      'An unexpected error occurred during verification',
      error,
    );
  }
};

export default VerifyManagerService;
