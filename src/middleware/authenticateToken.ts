// Authenticate token
/*
#Plan:
1. Accept and validate token
2. Authenticate token
3. Attach user id to request
*/

import { NextFunction, Response, Request } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../common/supabase/supabase.js';
import { errorResponseHelper } from '../utils/errorResponseHelper.js';
import logger from '../common/winston/logger.js';
import { randomUUID } from 'crypto';

const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authLogs = logger.child({
    service: 'authenticateToken',
    requestId: randomUUID(),
  });

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    authLogs.error('JWT SECRET configuration is missing');
    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Server configuration error',
          'MISSING_SECRET',
          'JWT secret is not configured',
        ),
      );
  }

  try {
    // 1. Accept and validate token
    if (!req.token || typeof req.token !== 'string') {
      authLogs.warn('User token not found or format invalid');
      return res
        .status(401)
        .json(
          errorResponseHelper(
            'User token not found or format invalid',
            'TOKEN_MISSING_OR_INVALID',
            'User token not found or format invalid',
          ),
        );
    }

    // 2. Authenticate token
    const decoded = jwt.verify(req.token, JWT_SECRET);
    authLogs.info('Token decoded successfully');
    if (typeof decoded !== 'object' || decoded === null) {
      authLogs.warn('Decoded token is not an object');
      return res
        .status(401)
        .json(errorResponseHelper('Invalid token', 'INVALID_TOKEN', 'Invalid token'));
    }

    if (decoded?.role === 'manager') {
      const { data: managerData, error: managerError } = await supabaseAdmin
        .from('managers')
        .select('id')
        .eq('id', decoded.id)
        .eq('full_name', decoded.full_name)
        .maybeSingle();
      if (managerError) {
        authLogs.error('Error fetching manager data', { error: managerError });
        return res
          .status(401)
          .json(
            errorResponseHelper(
              'Error fetching manager data',
              'MANAGER_FETCH_ERROR',
              'Error fetching manager data',
              managerError,
            ),
          );
      }

      if (!managerData) {
        authLogs.warn('Manager not found');
        return res
          .status(401)
          .json(errorResponseHelper('Manager not found', 'MANAGER_NOT_FOUND', 'Manager not found'));
      }

      // 3. Attach manager id to request
      req.userId = managerData.id;
      return next();
    } else {
      req.userId = ''; // Placeholder for other roles until implemented
      return next();
    }
  } catch (error: any) {
    authLogs.error('authenticateToken error matched', {
      name: error?.name,
      message: error?.message,
    });

    if (error?.name === 'TokenExpiredError') {
      return res
        .status(401)
        .json(errorResponseHelper('Expired token', 'EXPIRED_TOKEN', 'Expired token'));
    }

    if (error?.name === 'JsonWebTokenError') {
      return res
        .status(401)
        .json(
          errorResponseHelper(
            'Malformed token',
            'INVALID_TOKEN',
            'The token signature is invalid',
            error,
          ),
        );
    }

    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Internal server error',
          'INTERNAL_ERROR',
          'Unexpected error while authenticating token',
          error,
        ),
      );
  }
};

export default authenticateToken;
