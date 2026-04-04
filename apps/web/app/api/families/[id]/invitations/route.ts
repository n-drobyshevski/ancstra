import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAuthContext } from '@/lib/auth/context';
import { requirePermission, createInvitation, revokeInvite, logActivity, type ActivityAction } from '@ancstra/auth';
import { createCentralDb, centralSchema } from '@ancstra/db';
import { eq, and, isNull, gt } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuthContext();
    const { id: familyId } = await params;

    requirePermission(ctx.role, 'members:manage');

    const centralDb = createCentralDb();
    const now = new Date().toISOString();

    const pending = await centralDb
      .select()
      .from(centralSchema.invitations)
      .where(
        and(
          eq(centralSchema.invitations.familyId, familyId),
          isNull(centralSchema.invitations.acceptedAt),
          isNull(centralSchema.invitations.revokedAt),
          gt(centralSchema.invitations.expiresAt, now)
        )
      )
      .all();

    return NextResponse.json(pending);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message === 'Not authenticated or no family membership') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message.includes('permission')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuthContext();
    const { id: familyId } = await params;

    requirePermission(ctx.role, 'members:manage');

    const body = await request.json();
    const { email, role } = body as { email?: string; role: 'admin' | 'editor' | 'viewer' };

    if (!role || !['admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, editor, or viewer.' },
        { status: 400 }
      );
    }

    const centralDb = createCentralDb();

    const invitation = await createInvitation(centralDb, {
      familyId,
      invitedById: ctx.userId,
      email,
      role,
      inviterRole: ctx.role,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const link = `${baseUrl}/invite/${invitation.token}`;

    await logActivity(centralDb, {
      familyId,
      userId: ctx.userId,
      action: 'invite_sent' as ActivityAction,
      summary: `Sent an invitation${email ? ` to ${email}` : ''} as ${role}`,
      metadata: { email, role, invitationId: invitation.id },
    });
    revalidateTag('activity');

    return NextResponse.json({ ...invitation, link }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message === 'Not authenticated or no family membership') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message.includes('permission')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('Only owners') || message.includes('limit')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuthContext();
    await params; // consume params for consistency

    requirePermission(ctx.role, 'members:manage');

    const url = new URL(request.url);
    const invitationId = url.searchParams.get('id');

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Missing invitation id query parameter' },
        { status: 400 }
      );
    }

    const centralDb = createCentralDb();

    await revokeInvite(centralDb, invitationId, ctx.userId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message === 'Not authenticated or no family membership') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message.includes('permission')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message === 'Invitation not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
