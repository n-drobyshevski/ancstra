export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

export const VALID_ROLES = ['owner', 'admin', 'editor', 'viewer'] as const satisfies readonly Role[];

/** Returns the value as Role if it is a valid role string, otherwise null. */
export function parseRole(value: unknown): Role | null {
  if (typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value)) {
    return value as Role;
  }
  return null;
}

export type Permission =
  | 'tree:view' | 'tree:export' | 'tree:delete'
  | 'person:create' | 'person:edit' | 'person:delete'
  | 'family:create' | 'family:edit' | 'family:delete'
  | 'event:create' | 'event:edit' | 'event:delete'
  | 'source:create' | 'source:edit' | 'source:delete'
  | 'media:upload' | 'media:delete'
  | 'gedcom:import' | 'gedcom:export'
  | 'ai:research'
  | 'relationship:validate'
  | 'members:manage' | 'members:invite' | 'members:transfer-ownership'
  | 'settings:manage'
  | 'contributions:review'
  | 'activity:view';

export type ActivityAction =
  | 'person_added' | 'person_edited' | 'person_deleted' | 'persons_bulk_deleted'
  | 'relationship_added'
  | 'media_uploaded'
  | 'gedcom_imported'
  | 'invite_sent' | 'invite_accepted' | 'invite_revoked'
  | 'role_changed' | 'member_removed'
  | 'contribution_submitted' | 'contribution_approved' | 'contribution_rejected'
  | 'owner_transferred'
  | 'family_settings_updated';

export type ContributionOperation = 'create' | 'update' | 'delete';
export type ContributionStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';
export type ContributionEntityType = 'person' | 'family' | 'event' | 'source' | 'media';

export interface RequestContext {
  userId: string;
  familyId: string;
  role: Role;
  dbFilename: string;
}

export class ForbiddenError extends Error {
  public readonly permission: Permission;
  constructor(permission: Permission) {
    super(`Forbidden: missing permission '${permission}'`);
    this.name = 'ForbiddenError';
    this.permission = permission;
  }
}

export class ConcurrentTransferError extends Error {
  constructor(message = 'Concurrent transfer detected. Please retry.') {
    super(message);
    this.name = 'ConcurrentTransferError';
  }
}
