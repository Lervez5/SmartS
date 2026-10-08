import winston from 'winston';

const isDev = process.env.NODE_ENV !== 'production';

const consoleFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const devFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.colorize(),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    /**
     * Render whatever the caller attached as extra fields.
     *
     * This used to read `info.metadata`, which is always undefined: winston
     * spreads the second argument's keys across the top level of `info`, not
     * into a `metadata` namespace. Every log line in the API therefore printed
     * a trailing `""` and silently dropped its context - error messages, port
     * numbers and env were all invisible, which is how a startup failure could
     * report nothing actionable at all.
     */
    const { timestamp, level, message, stack, service, ...rest } = info as Record<string, unknown>;
    const context = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    const trace = typeof stack === 'string' && stack ? `\n${stack}` : '';

    return `${timestamp} [${level}]: ${message}${context}${trace}`;
  })
);

export const logger = winston.createLogger({
  level: 'info',
  format: isDev ? devFormat : consoleFormat,
  defaultMeta: { service: 'schoolos-api' },
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
});

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
