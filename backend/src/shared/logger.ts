import winston from "winston";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) =>
          JSON.stringify({
            level: info.level,
            message: info.message,
            timestamp: info.timestamp,
            ...info,
          })
        )
      ),
    }),
  ],
});


