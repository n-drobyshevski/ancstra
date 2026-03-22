import { requireAuthContext } from '@/lib/auth/context';
import { hasPermission } from '@ancstra/auth';
import { redirect } from 'next/navigation';
import { MemberList } from '@/components/members/member-list';
import { InviteDialog } from '@/components/members/invite-dialog';
import { PendingInvites } from '@/components/members/pending-invites';

export default async function MembersPage() {
  const ctx = await requireAuthContext();
  if (!hasPermission(ctx.role, 'members:manage')) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Family Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage who has access to your family tree and their permissions.
          </p>
        </div>
        <InviteDialog familyId={ctx.familyId} />
      </div>
      <MemberList familyId={ctx.familyId} currentUserId={ctx.userId} currentRole={ctx.role} />
      <PendingInvites familyId={ctx.familyId} />
    </div>
  );
}
