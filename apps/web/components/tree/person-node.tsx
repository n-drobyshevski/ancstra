import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { PersonNodeData } from './tree-utils';

type PersonNodeType = Node<PersonNodeData, 'person'>;

const sexColors = {
  M: { border: '#4f6bed', bg: '#e8ecf4', text: '#4f6bed' },
  F: { border: '#ec4899', bg: '#fce7f3', text: '#ec4899' },
  U: { border: '#9ca3af', bg: '#f3f4f6', text: '#6b7280' },
} as const;

function PersonNodeComponent({ data, selected }: NodeProps<PersonNodeType>) {
  const dimmed = !!(data as any).dimmed;
  const colors = sexColors[data.sex] ?? sexColors.U;
  const initials = `${data.givenName[0] ?? ''}${data.surname[0] ?? ''}`.toUpperCase();

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-muted-foreground/40" />
      <div
        className={`w-[200px] rounded-lg bg-card shadow-sm border transition-all ${
          selected ? 'ring-2 ring-primary shadow-md' : ''
        } ${dimmed ? 'opacity-30 pointer-events-none' : ''}`}
        style={{ borderLeftWidth: 4, borderLeftColor: colors.border }}
      >
        <div className="flex items-center gap-2.5 p-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-foreground">
              {data.givenName} {data.surname}
            </div>
            {data.birthDate && (
              <div className="text-[11px] text-muted-foreground">b. {data.birthDate}</div>
            )}
            {data.deathDate && (
              <div className="text-[11px] text-muted-foreground">d. {data.deathDate}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export const PersonNode = memo(PersonNodeComponent);
