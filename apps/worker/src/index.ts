import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { auth } from './middleware/auth';
import { health } from './routes/health';

const app = new Hono();

// Middleware
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:3000',
      ...(process.env.WEB_URL ? [process.env.WEB_URL] : []),
    ],
  })
);
app.use('*', logger());
app.use('*', auth);

// Routes
app.route('/', health);

// Export type for RPC client usage
export type AppType = typeof app;

// Start server
const port = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Worker listening on http://localhost:${info.port}`);
});

export { app };
