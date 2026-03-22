import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

export const auth = createMiddleware(async (c, next) => {
  // Skip auth for health check
  if (c.req.path === '/health') {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    console.error('AUTH_SECRET is not configured');
    return c.json({ error: 'Server misconfiguration' }, 500);
  }

  try {
    const encodedSecret = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encodedSecret);

    if (!payload.sub) {
      return c.json({ error: 'Invalid token: missing subject' }, 401);
    }

    c.set('userId', payload.sub);
    return next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});
