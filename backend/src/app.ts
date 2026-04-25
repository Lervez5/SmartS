import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import hpp from "hpp";
import csrf from "csurf";
import { rateLimiterMiddleware } from "./security/rateLimiter";
import { requestAuditMiddleware } from "./audit/auditMiddleware";
import { errorHandler } from "./shared/errorHandler";
import { metricsRouter, metricsMiddleware } from "./observability/metrics";
import { router as apiRouter } from "./routes";

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "*", "blob:"],
        "upgrade-insecure-requests": null,
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
    credentials: true,
  })
);

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(hpp());
app.use(morgan("combined"));
app.use(metricsMiddleware);
app.use(rateLimiterMiddleware);
app.use(requestAuditMiddleware);

// CSRF protection for admin/parent dashboards via cookie
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  },
});

app.use("/api/admin", csrfProtection);
app.use("/api/parent", csrfProtection);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/uploads", express.static("uploads"));
app.use("/metrics", metricsRouter);
app.use("/api", apiRouter);

app.use(errorHandler);

export default app;


