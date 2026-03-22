export type Role = 'owner' | 'admin' | 'editor' | 'viewer';

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
  | 'members:manage' | 'members:invite'
  | 'settings:manage'
  | 'contributions:review'
  | 'activity:view';

export type ActivityAction =
  | 'person_added' | 'person_edited' | 'person_deleted'
  | 'relationship_added'
  | 'media_uploaded'
  | 'gedcom_imported'
  | 'invite_sent' | 'invite_accepted'
  | 'role_changed' | 'member_removed'
  | 'contribution_submitted' | 'contribution_approved' | 'contribution_rejected'
  | 'owner_transferred';

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
