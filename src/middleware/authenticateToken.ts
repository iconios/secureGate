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

const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('JWT SECRET is required');
  }

  try {
    // 1. Accept and validate token
    if (!req.token || typeof req.token !== 'string') {
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
    if (typeof decoded !== 'object') {
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
        return res
          .status(401)
          .json(errorResponseHelper('Manager not found', 'MANAGER_NOT_FOUND', 'Manager not found'));
      }

      // 3. Attach manager id to request
      req.userId = managerData.id;
      next();
    }

    req.userId = ''; // Placeholder for other roles until implemented
    next();
  } catch (error) {
    console.error('authenticateToken error:', error);

    if (error instanceof jwt.TokenExpiredError) {
      return res
        .status(401)
        .json(errorResponseHelper('Expired token', 'EXPIRED_TOKEN', 'Expired token'));
    }

    return res
      .status(500)
      .json(
        errorResponseHelper(
          'Internal server error',
          'INTERNAL_ERROR',
          'Unexpected error while authenticating token',
        ),
      );
  }
};

export default authenticateToken;
