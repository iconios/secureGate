import { createLogger, format, transports } from 'winston';
import path from 'path';
import 'winston-daily-rotate-file';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const isProduction = process.env.NODE_ENV === 'production';

// Shared timestamp
const timestampFormat = format.timestamp({
  format: 'YYYY-MM-DD HH:mm:ss.SSS',
});

// Console format (pretty, colored)
const consoleFormat = format.combine(
  format.colorize(),
  timestampFormat,
  format.errors({ stack: true }),
  format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${stack || message}${metaString}`;
  }),
);

// File format (JSON, structured, no color)
const jsonFormat = format.combine(timestampFormat, format.errors({ stack: true }), format.json());

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  exitOnError: false,
  transports: [
    new transports.Console({
      format: isProduction ? jsonFormat : consoleFormat,
    }),

    new transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: jsonFormat,
    }),

    new transports.DailyRotateFile({
      filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      format: jsonFormat,
    }),
  ],
});

export default logger;
