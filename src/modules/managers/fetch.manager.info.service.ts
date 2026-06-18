// Fetch Manager Info Service
/*
#Plan:
1. Receive and validate the token
2. Validate JWT secret
3. Verify the token and catch expiry separately
4. Send response with manager info to caller
*/

import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import jwt from 'jsonwebtoken';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { FetchManagerInfo } from './managers.types.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';

const FetchManagerInfoService = async (token: string) => {
  const managerLogs = logger.child({
    service: 'FetchManagerInfoService',
    requestId: randomUUID(),
  });

  try {
    // 1. Receive and validate the token
    if (!token) {
      managerLogs.warn('Token cannot be empty');
      return errorResponseHelper('Token cannot be empty', 'EMPTY_TOKEN', 'Token cannot be empty');
    }

    // 2. Validate JWT secret
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      managerLogs.warn('Jwt secret cannot be empty');
      return errorResponseHelper(
        'Jwt secret cannot be empty',
        'EMPTY_JWT_SECRET',
        'Jwt secret cannot be empty',
      );
    }

    // 3. Verify the token and catch expiry separately
    const decoded = jwt.verify(token, JWT_SECRET) as FetchManagerInfo;
    if (!decoded) {
      managerLogs.warn('Token can not be decoded');
      return errorResponseHelper(
        'Token can not be decoded',
        'TOKEN_NOT_DECODED',
        'Token can not be decoded',
      );
    }

    // 4. Send response with manager info to caller
    managerLogs.info('Token decoded successfully', {
      email: redactEmailUsername(decoded.email),
      role: decoded.role,
    });
    return successResponseHelper('Token decoded successfully', {
      user: {
        id: decoded.id,
        email: decoded.email,
        full_name: decoded.full_name,
      },
      role: decoded.role,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      managerLogs.warn('Manager token expired', {
        reason: error.message,
        expiredAt: error.expiredAt,
      });

      return errorResponseHelper(
        'Session expired. Please log in again.',
        'TOKEN_EXPIRED',
        'Session expired. Please log in again.',
        {
          expiredAt: error.expiredAt,
        },
      );
    }

    if (error instanceof jwt.JsonWebTokenError) {
      managerLogs.warn('Invalid manager token', {
        reason: error.message,
      });

      return errorResponseHelper(
        'Invalid token. Please log in again.',
        'INVALID_TOKEN',
        'Invalid token. Please log in again.',
        error,
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'unknown error';
    managerLogs.warn('Error while decoding manager token', {
      reason: errorMessage,
      error,
    });
    return errorResponseHelper(
      'Error while decoding manager token',
      'TOKEN_DECODE_ERROR',
      'Error while decoding manager token',
      error,
    );
  }
};

export default FetchManagerInfoService;
