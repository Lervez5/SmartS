import winston from "winston";

const isDev = process.env.NODE_ENV !== "production";

const consoleFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const devFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf((info) => {
    return `${info.timestamp} [${info.level}]: ${info.message} ${JSON.stringify(info.metadata || "")}`;
  })
);

export const logger = winston.createLogger({
  level: "info",
  format: isDev ? devFormat : consoleFormat,
  defaultMeta: { service: "school-os-api" },
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

winston.addColors({
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "blue",
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
