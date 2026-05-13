// Login Manager Service
/*
Plan:
1. Accept and validate the login credentials (email and password)
2. Check if the manager exists
3. Verify the password
4. Generate a JWT token for the manager
5. Return the token and manager details
*/

import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../common/supabase/supabase';
import { errorResponseHelper } from '../../utils/errorResponseHelper';
import { compareString } from '../../utils/hashHelper';
import { successResponseHelper } from '../../utils/successResponseHelper';
import { LoginManagerData, loginManagerDataSchema } from './managers.types';
import jwt from 'jsonwebtoken';
import logger from '../../common/winston/logger';
import { ZodError } from 'zod';

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
      .select('id, full_name, email, password_hash')
      .eq('email', email)
      .maybeSingle();

    if (error || !manager) {
      managerLogs.error('Invalid email or password', { email, error: error ?? null });
      return errorResponseHelper(
        'Invalid email or password',
        'INVALID_CREDENTIALS',
        'Invalid credentials provided',
      );
    }

    // 3. Verify the password
    const isPasswordValid = await compareString(password, manager.password_hash);
    if (!isPasswordValid) {
      managerLogs.error('Invalid email or password', { email, error: error ?? null });
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
    };
    const token = jwt.sign(payload, JWT_SECRET!, { expiresIn: '10h' });

    // 5. Return the token and manager details
    return successResponseHelper('Login successful', {
      token,
      manager: {
        id: manager.id,
        full_name: manager.full_name,
        email: manager.email,
      },
    });
  } catch (error) {
    if (isDev) {
      console.error('Error in LoginManagerService:', error);
    }
    managerLogs.error('Error occurred while logging in manager', { error });

    if (error instanceof ZodError) {
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
