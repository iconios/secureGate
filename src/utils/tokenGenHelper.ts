import crypto from 'node:crypto';

export const tokenGenHelper = (): string => {
  return crypto.randomBytes(32).toString('hex');
};
