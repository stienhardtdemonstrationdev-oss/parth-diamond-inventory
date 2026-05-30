import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import diamondRoutes from './routes/diamond.routes.js';
import customerRoutes from './routes/customer.routes.js';
import memoRoutes from './routes/memo.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// Behind Render's proxy — needed for correct client IPs (rate limiting) & protocol.
app.set('trust proxy', 1);

// Security headers + response compression
app.use(helmet());
app.use(compression());

// CORS — allow configured frontend origins (comma-separated)
const allowed = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Allow any Vercel deployment of this project (production + previews) without
// having to whitelist each generated domain.
const VERCEL_ORIGIN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser tools (no origin), explicit allow-list, and *.vercel.app
      if (!origin || allowed.includes(origin) || VERCEL_ORIGIN.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — a global cap, plus a stricter cap on auth to deter brute force.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});
app.use('/api', apiLimiter);

// Health check (handy for Render)
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/diamonds', diamondRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/memos', memoRoutes);
app.use('/api/invoices', invoiceRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
