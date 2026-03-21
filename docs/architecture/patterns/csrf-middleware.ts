// docs/architecture/patterns/csrf-middleware.ts
// Integration target: apps/web/lib/api/middleware.ts
//
// Addresses: AA-3 (RBAC enforcement), IS-8 (CSRF protection)

import { auth } from '@/auth'; // NextAuth.js v5
import { NextRequest, NextResponse } from 'next/server';

type Role = 'owner' | 'admin' | 'editor' | 'viewer';

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface AuthOptions {
  minRole: Role;
}

/**
 * Wraps an API route handler with authentication, authorization, and CSRF checks.
 *
 * Usage:
 *   export const POST = withAuth({ minRole: 'editor' }, async (req, session) => {
 *     // handler code — session is guaranteed valid with sufficient role
 *     return NextResponse.json({ ok: true });
 *   });
 */
export function withAuth(
  options: AuthOptions,
  handler: (req: NextRequest, session: any) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    // 1. Verify session
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check CSRF for mutation methods
    if (MUTATION_METHODS.has(req.method)) {
      const csrfHeader = req.headers.get('X-Requested-With');
      if (csrfHeader !== 'XMLHttpRequest') {
        return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
      }
    }

    // 3. Check role authorization
    // TODO: Extend NextAuth Session type to include `role` in next-auth.d.ts
    const userRole = (session.user as any).role as Role;
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[options.minRole]) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. Execute handler
    return handler(req, session);
  };
}
