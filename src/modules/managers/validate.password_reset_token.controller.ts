// Validate Password Reset Token Manager Controller
/*
#Plan:
1. Accept and validate the password reset token data
2. Pass the data to ValidatePasswordResetTokenService
3. Send the appropriate response to the caller/client
*/

import { Request, Response } from 'express';
import ValidateManagerPasswordResetTokenService from './validate.password_reset_token.service.js';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';
const __dirname = dirname(fileURLToPath(import.meta.url));
const passwordResetFormPath = join(__dirname, '../../../src/common/postmark/passwordResetForm.htm');

const expiredTokenPath = join(__dirname, '../../../src/common/postmark/expiredToken.htm');

const ValidatePasswordResetTokenManagerController = async (req: Request, res: Response) => {
  const managerLogs = logger.child({
    service: 'ValidatePasswordResetTokenManagerController',
    requestId: randomUUID(),
  });

  try {
    // Step 1. Accept and validate the password reset token data
    const { request_id, token } = req.query;
    if (!request_id || !token) {
      managerLogs.error(`Required fields missing`);
      return res.status(400).sendFile(expiredTokenPath);
    }

    if (typeof request_id !== 'string' || typeof token !== 'string') {
      managerLogs.error('Invalid format for the required fields');
      return res.status(400).sendFile(expiredTokenPath);
    }

    // Step 2. Pass the data to ValidateManagerPasswordResetTokenService
    const result = await ValidateManagerPasswordResetTokenService({ request_id, token });

    // Step 3. Send the appropriate response to the caller/client
    if (!result.success) {
      managerLogs.warn('Expired or invalid password reset token');
      return res.status(400).sendFile(expiredTokenPath);
    }

    return res.status(200).sendFile(passwordResetFormPath);
  } catch (error) {
    managerLogs.error('Error in ValidatePasswordResetTokenManagerController', {
      error: error instanceof Error ? error.message : error,
    });

    return res.status(500).sendFile(expiredTokenPath);
  }
};

export default ValidatePasswordResetTokenManagerController;
