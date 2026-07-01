import 'dotenv/config';
import newrelic from 'newrelic';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import ManagerRouter from './modules/managers/managers.routes.js';
import logger from './common/winston/logger.js';
import { errorResponseHelper } from './utils/errorResponseHelper.js';
import PlansRouter from './modules/subscriptionPlans/plans.routes.js';
import { EstatesManagerRouter } from './modules/estateManagers/estate_manager.routes.js';
import PaymentRouter from './modules/payments/payment.routes.js';
import UpdateEstatePaymentDetailsController from './modules/payments/update.estate_payment_details.controller.js';
import { dbMaintenanceRouter } from './modules/dbMaintenance/dbMaintenance.routes.js';
import { HouseholdsRouter } from './modules/houseHolds/households.routes.js';

const app = express();
const PORT = process.env.PORT || 3010;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
  }),
);

app.post(
  '/api/v1/payments/webhook/paystack',
  express.raw({ type: 'application/json' }),
  UpdateEstatePaymentDetailsController,
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/health', (_, res) => res.send('OK'));
app.use('/api/v1/managers', ManagerRouter);
app.use('/api/v1/subscription_plans', PlansRouter);
app.use('/api/v1/estates_manager', EstatesManagerRouter);
app.use('/api/v1/payments', PaymentRouter);
app.use('/api/v1/maintenance', dbMaintenanceRouter);
app.use('/api/v1/households', HouseholdsRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  logger.warn('Endpoint not found', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
  });

  res
    .status(404)
    .json(
      errorResponseHelper(
        'Endpoint not found',
        'ENDPOINT_NOT_FOUND',
        `The route ${req.method} ${req.path} does not exist.`,
      ),
    );
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled application error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
  });

  newrelic.noticeError(err, {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
  });

  if (res.headersSent) {
    return next(err);
  }

  res
    .status(500)
    .json(
      errorResponseHelper(
        'Something went wrong',
        'INTERNAL_SERVER_ERROR',
        'Something went wrong',
        err,
      ),
    );
});

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
