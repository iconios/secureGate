// Login Manager Service
/*
Plan:
1. Accept and validate the login credentials (email and password)
2. Check if the manager exists and is verified
3. Verify the password
4. Generate a JWT token for the manager
5. Update last_login_at record
6. Return the token and manager details
*/

import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { compareString } from '../../utils/hashHelper.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { LoginManagerData, loginManagerDataSchema } from './managers.types.js';
import jwt from 'jsonwebtoken';
import logger from '../../common/winston/logger.js';
import { ZodError } from 'zod';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';

const LoginManagerService = async (loginData: LoginManagerData) => {
  const isDev = process.env.NODE_ENV === 'development';
  const JWT_SECRET = process.env.JWT_SECRET;
  const managerLogs = logger.child({
    service: 'loginManagerService',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the login credentials (email and password)
    const { email, password } = loginManagerDataSchema.parse(loginData);

    // 2. Check if the manager exists
    const { data: manager, error } = await supabaseAdmin
      .from('managers')
      .select('id, full_name, email, password_hash, is_verified')
      .eq('email', email)
      .maybeSingle();

    if (error || !manager) {
      managerLogs.error('Invalid email or password', {
        email: redactEmailUsername(email),
        error: error ?? null,
      });

      return errorResponseHelper(
        'Invalid email or password',
        'INVALID_CREDENTIALS',
        'Invalid credentials provided',
      );
    }

    if (!manager.is_verified) {
      managerLogs.warn('User account not verified', {
        email: redactEmailUsername(manager.email),
      });
      return errorResponseHelper(
        'User account not verified',
        'USER_NOT_VERIFIED',
        'User account not verified',
      );
    }

    // 3. Verify the password
    const isPasswordValid = await compareString(password, manager.password_hash);
    if (!isPasswordValid) {
      managerLogs.error('Invalid email or password', {
        email: redactEmailUsername(email),
      });

      return errorResponseHelper(
        'Invalid email or password',
        'INVALID_CREDENTIALS',
        'Invalid credentials provided',
      );
    }

    // 4. Generate a JWT token for the manager
    const payload = {
      id: manager.id,
      full_name: manager.full_name,
      email: manager.email,
      role: 'manager',
    };
    const token = jwt.sign(payload, JWT_SECRET!, { expiresIn: '10h' });

    // 5. Update last_login_at record
    const { error: updateError } = await supabaseAdmin
      .from('managers')
      .update({
        last_login_at: new Date().toISOString(),
      })
      .eq('id', manager.id)
      .eq('email', manager.email);

    if (updateError) {
      managerLogs.error('Error updating manager record while logging in', {
        email: redactEmailUsername(email),
        error: updateError,
      });
      return errorResponseHelper(
        'Error updating manager record while logging in',
        'UPDATE_ERROR',
        'Error updating manager record while logging in',
        updateError,
      );
    }

    // 6. Return the token and manager details
    managerLogs.info('Login successful for manager', {
      email: redactEmailUsername(manager.email),
    });
    return successResponseHelper('Login successful', {
      token,
      user: {
        id: manager.id,
        full_name: manager.full_name,
        email: manager.email,
      },
      role: 'manager',
    });
  } catch (error) {
    if (isDev) {
      console.error('Error in LoginManagerService:', error);
    }
    managerLogs.error('Error occurred while logging in manager', { error });

    if (error instanceof ZodError) {
      managerLogs.error('Validation error in login data', {
        error: error.message,
        cause: error.cause,
      });

      return errorResponseHelper(
        'Invalid input data',
        'BAD_REQUEST',
        'Invalid input data provided',
        error,
      );
    }

    return errorResponseHelper(
      'An error occurred while logging in',
      'INTERNAL_SERVER_ERROR',
      'Failed to login manager',
      error,
    );
  }
};

export default LoginManagerService;
