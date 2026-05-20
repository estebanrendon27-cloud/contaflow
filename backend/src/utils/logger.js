import winston from 'winston';
import { existsSync, mkdirSync } from 'fs';

const logDir = './logs';
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

const fmt = winston.format;

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fmt.combine(
    fmt.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    fmt.errors({ stack: true }),
    fmt.json()
  ),
  transports: [
    new winston.transports.Console({
      format: fmt.combine(
        fmt.colorize(),
        fmt.printf(({ timestamp, level, message, stack }) =>
          `${timestamp} [${level}]: ${stack || message}`
        )
      )
    }),
    new winston.transports.File({
      filename: process.env.LOG_FILE || './logs/contaflow.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: './logs/errors.log',
      level: 'error',
    }),
  ],
});
