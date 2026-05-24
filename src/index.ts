import 'dotenv/config';
import newrelic from 'newrelic';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import ManagerRouter from './modules/managers/managers.routes';
import logger from './common/winston/logger';
import { errorResponseHelper } from './utils/errorResponseHelper';

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_, res) => res.send('OK'));
app.use('/api/v1/managers', ManagerRouter);

app.use((req: Request, res: Response) => {
  logger.warn('Endpoint not found', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
  });

  res.status(404).json(
    errorResponseHelper(
      'Endpoint not found',
      'ENDPOINT_NOT_FOUND',
      `The route ${req.method} ${req.path} does not exist.`,
    ));
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

  res.status(500).json(
    errorResponseHelper(
      'Something went wrong',
      'INTERNAL_SERVER_ERROR',
      'Something went wrong',
      err
    )
  )
});

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
