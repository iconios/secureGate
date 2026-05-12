import rateLimit from 'express-rate-limit';

export const managerCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,

  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many manager creation attempts from this IP address. Please try again later.',
      retryAfterSeconds: 15 * 60,
      retryAfter: '15 minutes',
    });
  },
});
