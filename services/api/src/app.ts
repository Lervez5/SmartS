import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import hpp from 'hpp';
import csrf from 'csurf';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { rateLimiterMiddleware } from './middleware/rateLimiter';
import { auditMiddleware } from './middleware/audit';
import { errorHandler } from './middleware/errorHandler';
import { router as apiRouter } from './routes';
import { metricsRouter, metricsMiddleware } from './observability/metrics';

const app: Express = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', '*', 'blob:'],
        'upgrade-insecure-requests': null,
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
  })
);

app.use(compression());
// Branding uploads are multipart; this must be registered before the JSON
// body parser so the stream is not consumed.
app.use('/api/uploads', express.raw({ type: '*/*', limit: '6mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(hpp());
app.use(morgan('combined'));
app.use(metricsMiddleware);
app.use(rateLimiterMiddleware);
app.use(auditMiddleware);
app.use(authMiddleware);

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
  },
});

app.use('/api/admin', csrfProtection as unknown as express.RequestHandler);
app.use('/api/parent', csrfProtection as unknown as express.RequestHandler);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/uploads', express.static(config.storage.localRoot));
app.use('/metrics', metricsRouter);
app.use('/api', apiRouter);

app.use(errorHandler);

export default app;
