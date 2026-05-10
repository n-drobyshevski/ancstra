'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveThread } from '@/lib/research/active-thread';

interface MentionCascadeChipProps {
  sourceFactsheetId: string;
  sourceFactId: string;
  mentionedName: string;          // e.g., "Maria"
  relationshipLabel: string;      // e.g., "wife" — for the new factsheet title
  relationshipType: 'parent_child' | 'spouse' | 'sibling';
  sourceTitle: string;            // for the reason field, e.g., "marriage cert"
  /** Called after successful cascade with the new factsheet id. */
  onCascade?: (newFactsheetId: string) => void;
  /** Show actor='ai' attribution (e.g., when chip came from AI extraction tray). */
  fromAI?: boolean;
}

export function MentionCascadeChip(props: MentionCascadeChipProps) {
  const { thread } = useActiveThread();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!thread) {
      toast.message('Start a research thread', {
        description: 'Pivot tracking only works when a thread is active. Open the Threads side panel to start one.',
      });
      return;
    }

    const newFactsheetTitle = `${props.mentionedName} (${props.relationshipLabel})`;
    const reason = `${props.relationshipLabel} mentioned in ${props.sourceTitle}`;

    startTransition(async () => {
      const res = await fetch(`/api/research/threads/${thread.id}/cascade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFactsheetId: props.sourceFactsheetId,
          sourceFactId: props.sourceFactId,
          newFactsheetTitle,
          relationshipType: props.relationshipType,
          reason,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        toast.error('Cascade failed', { description: text });
        return;
      }
      const body = await res.json();
      toast.success('Linked factsheet created', {
        description: `Created factsheet for ${props.mentionedName} and linked it to the source.`,
      });
      props.onCascade?.(body.factsheetId);
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className="gap-1 text-xs"
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />}
      <span>{props.mentionedName}</span>
      {props.fromAI && <span className="ml-1 text-muted-foreground">·AI</span>}
    </Button>
  );
}
