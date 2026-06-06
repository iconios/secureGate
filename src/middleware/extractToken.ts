import { randomUUID } from 'crypto';
import { NextFunction, Response, Request } from 'express';
import logger from '../common/winston/logger.js';

const extractToken = (req: Request, _res: Response, next: NextFunction) => {
  const authLogs = logger.child({
    service: 'extractToken',
    requestId: randomUUID(),
  });

  const authHeader = req.get('Authorization') || req.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    authLogs.info('Authorization header found with valid format');
    req.token = authHeader.slice(7).trim();
  } else {
    authLogs.warn('Authorization header missing or does not start with Bearer');
    req.token = undefined;
  }

  next();
};

export default extractToken;
