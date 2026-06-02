import { NextFunction, Response, Request } from 'express';

const extractToken = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.get('Authorization') || req.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    req.token = authHeader.slice(7).trim();
  } else {
    req.token = undefined;
  }

  next();
};

export default extractToken;
