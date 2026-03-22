import crypto from 'node:crypto';
import { eq, and, isNull, count } from 'drizzle-orm';
import * as centralSchema from '@ancstra/db/central-schema';
import type { Role } from './types';

// Accept any Drizzle DB instance (works with both better-sqlite3 and libsql drivers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CentralDb = any;
type InviteRole = 'admin' | 'editor' | 'viewer';

export interface CreateInvitationOpts {
  familyId: string;
  invitedById: string;
  email?: string;
  role: InviteRole;
  inviterRole: Role;
  expiresInDays?: number;
}

export interface InvitationRow {
  id: string;
  familyId: string;
  invitedBy: string;
  email: string | null;
  role: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  createdAt: string;
}

export interface ValidateResult {
  valid: boolean;
  invitation?: InvitationRow;
  reason?: string;
}

/**
 * Generate a cryptographically secure 64-character hex invite token.
 */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new invitation for a family.
 * Enforces:
 * - Max 20 active (pending) invitations per family
 * - Only owners can invite admins
 */
export async function createInvitation(
  centralDb: CentralDb,
  opts: CreateInvitationOpts
): Promise<InvitationRow> {
  const { familyId, invitedById, email, role, inviterRole, expiresInDays = 7 } = opts;

  // Role constraint: only owner can invite admin
  if (role === 'admin' && inviterRole !== 'owner') {
    throw new Error('Only owners can invite admins');
  }

  // Check active invite count (pending = not accepted, not revoked, not expired)
  const now = new Date().toISOString();
  const activeInvites = await centralDb
    .select({ count: count() })
    .from(centralSchema.invitations)
    .where(
      and(
        eq(centralSchema.invitations.familyId, familyId),
        isNull(centralSchema.invitations.acceptedAt),
        isNull(centralSchema.invitations.revokedAt)
      )
    )
    .get();

  const activeCount = activeInvites?.count ?? 0;
  if (activeCount >= 20) {
    throw new Error('Maximum active invitation limit (20) reached');
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const invitation = await centralDb
    .insert(centralSchema.invitations)
    .values({
      familyId,
      invitedBy: invitedById,
      email: email ?? null,
      role,
      token,
      expiresAt,
    })
    .returning()
    .get();

  return invitation as InvitationRow;
}

/**
 * Validate an invite token.
 * Checks: exists, not revoked, not accepted, not expired, email match, family not at max members.
 */
export async function validateInviteToken(
  centralDb: CentralDb,
  token: string,
  userEmail?: string
): Promise<ValidateResult> {
  const invitation = await centralDb
    .select()
    .from(centralSchema.invitations)
    .where(eq(centralSchema.invitations.token, token))
    .get();

  if (!invitation) {
    return { valid: false, reason: 'Invitation not found' };
  }

  if (invitation.revokedAt) {
    return { valid: false, reason: 'Invitation has been revoked' };
  }

  if (invitation.acceptedAt) {
    return { valid: false, reason: 'Invitation has already been accepted' };
  }

  const now = new Date();
  const expiresAt = new Date(invitation.expiresAt);
  if (now > expiresAt) {
    return { valid: false, reason: 'Invitation has expired' };
  }

  // Email mismatch check (only if invitation has an email and userEmail is provided)
  if (invitation.email && userEmail && invitation.email !== userEmail) {
    return { valid: false, reason: 'Email does not match invitation' };
  }

  // Check family max members
  const family = await centralDb
    .select()
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, invitation.familyId))
    .get();

  if (family) {
    const memberCount = await centralDb
      .select({ count: count() })
      .from(centralSchema.familyMembers)
      .where(
        and(
          eq(centralSchema.familyMembers.familyId, invitation.familyId),
          eq(centralSchema.familyMembers.isActive, 1)
        )
      )
      .get();

    if ((memberCount?.count ?? 0) >= family.maxMembers) {
      return { valid: false, reason: 'Family has reached maximum member limit' };
    }
  }

  return { valid: true, invitation: invitation as InvitationRow };
}

/**
 * Accept an invitation: validate, create family_members row, mark invitation accepted.
 */
export async function acceptInvite(
  centralDb: CentralDb,
  token: string,
  userId: string
): Promise<InvitationRow> {
  const result = await validateInviteToken(centralDb, token);

  if (!result.valid || !result.invitation) {
    throw new Error(result.reason ?? 'Invalid invitation');
  }

  const invitation = result.invitation;
  const now = new Date().toISOString();

  // Create family_members row
  await centralDb
    .insert(centralSchema.familyMembers)
    .values({
      familyId: invitation.familyId,
      userId,
      role: invitation.role as 'owner' | 'admin' | 'editor' | 'viewer',
      invitedRole: invitation.role,
      joinedAt: now,
    })
    .run();

  // Mark invitation as accepted
  const updated = await centralDb
    .update(centralSchema.invitations)
    .set({
      acceptedAt: now,
      acceptedBy: userId,
    })
    .where(eq(centralSchema.invitations.id, invitation.id))
    .returning()
    .get();

  return updated as InvitationRow;
}

/**
 * Revoke an invitation by setting revoked_at and revoked_by.
 */
export async function revokeInvite(
  centralDb: CentralDb,
  invitationId: string,
  revokedByUserId: string
): Promise<InvitationRow> {
  const now = new Date().toISOString();

  const updated = await centralDb
    .update(centralSchema.invitations)
    .set({
      revokedAt: now,
      revokedBy: revokedByUserId,
    })
    .where(eq(centralSchema.invitations.id, invitationId))
    .returning()
    .get();

  if (!updated) {
    throw new Error('Invitation not found');
  }

  return updated as InvitationRow;
}
