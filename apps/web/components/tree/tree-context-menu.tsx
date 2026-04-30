'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Pencil,
  FlaskConical,
  UserPlus,
  Target,
  ArrowUpToLine,
  ArrowDownToLine,
  Table2,
  Hash,
  Link2,
  ExternalLink,
  Trash2,
  Eye,
  Maximize,
  RefreshCw,
  Map as MapIcon,
  Download,
} from 'lucide-react';
import type { PersonListItem } from '@ancstra/shared';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleGate } from '@/components/auth/role-gate';
import { formatShortcut } from '@/lib/tree/format-shortcut';
import type { RelationType } from '@/components/person-link-dialog';

// ---------------------------------------------------------------------------
// Surface + trigger types
// ---------------------------------------------------------------------------

export type ContextMenuSurface =
  | { kind: 'node'; nodeId: string }
  | {
      kind: 'edge';
      edgeId: string;
      edgeFamilyId?: string;
      edgeChildId?: string;
      edgeType?: string;
    }
  | { kind: 'pane' };

export interface ContextMenuTrigger {
  x: number;
  y: number;
  surface: ContextMenuSurface;
  /** Ids of all currently selected nodes. When length > 1 and surface is
   *  'node', the multi-select branch renders. */
  selectionIds: string[];
}

interface TreeContextMenuProps {
  trigger: ContextMenuTrigger | null;
  persons: PersonListItem[];
  onClose: () => void;
  onAddRelation: (
    kind: 'create' | 'link',
    relation: RelationType,
    target: { id: string; name: string; sex: 'M' | 'F' | 'U' },
  ) => void;
  onDeleteRelationship: (edgeId: string) => void;
  /** Open the AlertDialog confirm for a single-person delete. The actual
   *  delete API call is owned by the parent. */
  onRequestDeletePerson: (personId: string) => void;
  /** Open the AlertDialog confirm for a bulk delete. */
  onRequestBulkDelete: (personIds: string[]) => void;
  onFocusOnPerson: (personId: string) => void;
  onSetTopologyAnchor: (
    person: PersonListItem,
    mode: 'ancestors' | 'descendants',
  ) => void;
  onFitView: () => void;
  onResetZoom: () => void;
  onToggleMinimap: () => void;
  onAddPerson: () => void;
  onExportSelection: (format: 'png' | 'svg' | 'pdf') => void;
}

// ---------------------------------------------------------------------------
// Root: controlled DropdownMenu anchored at (x, y)
// ---------------------------------------------------------------------------

export function TreeContextMenu(props: TreeContextMenuProps) {
  const { trigger, onClose, ...rest } = props;
  const open = trigger !== null;

  // Virtual trigger element sits at the cursor position. Radix DropdownMenu
  // anchors `Content` to its `Trigger` element — there is no separate Anchor
  // primitive on DropdownMenu (unlike Popover). `pointerEvents: 'none'` and
  // `tabIndex={-1}` keep it out of the way of the canvas; Radix uses only
  // its bounding box for positioning.
  const triggerStyle: React.CSSProperties = React.useMemo(
    () => ({
      position: 'fixed',
      left: trigger?.x ?? 0,
      top: trigger?.y ?? 0,
      width: 1,
      height: 1,
      pointerEvents: 'none',
    }),
    [trigger?.x, trigger?.y],
  );

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <span aria-hidden style={triggerStyle} tabIndex={-1} />
      </DropdownMenuTrigger>
      {trigger && <Body trigger={trigger} onClose={onClose} {...rest} />}
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Body: switches per surface
// ---------------------------------------------------------------------------

function Body(
  props: Omit<TreeContextMenuProps, 'trigger'> & { trigger: ContextMenuTrigger },
) {
  const { trigger } = props;
  const isMultiNode =
    trigger.surface.kind === 'node' && trigger.selectionIds.length > 1;

  return (
    <DropdownMenuContent
      align="start"
      sideOffset={2}
      collisionPadding={8}
      className="min-w-56 pointer-coarse:min-w-64"
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      {isMultiNode ? (
        <MultiSelectItems {...props} />
      ) : trigger.surface.kind === 'node' ? (
        <NodeItems {...props} surface={trigger.surface} />
      ) : trigger.surface.kind === 'edge' ? (
        <EdgeItems {...props} surface={trigger.surface} />
      ) : (
        <PaneItems {...props} />
      )}
    </DropdownMenuContent>
  );
}

// ---------------------------------------------------------------------------
// Single-node menu
// ---------------------------------------------------------------------------

const ADD_RELATION_GROUPS: Array<{ relation: RelationType; label: string }> = [
  { relation: 'spouse', label: 'Spouse' },
  { relation: 'father', label: 'Father' },
  { relation: 'mother', label: 'Mother' },
  { relation: 'child', label: 'Child' },
  { relation: 'sibling', label: 'Sibling' },
];

function NodeItems({
  surface,
  persons,
  onClose,
  onAddRelation,
  onRequestDeletePerson,
  onFocusOnPerson,
  onSetTopologyAnchor,
}: TreeContextMenuProps & { surface: { kind: 'node'; nodeId: string } }) {
  const router = useRouter();
  const person = persons.find((p) => p.id === surface.nodeId);
  if (!person) return null;

  const fullName = `${person.givenName} ${person.surname}`.trim();
  const lifespan = formatLifespan(person);
  const target = { id: person.id, name: fullName, sex: person.sex };

  const requestAddRelation = (
    kind: 'create' | 'link',
    relation: RelationType,
  ) => {
    onAddRelation(kind, relation, target);
    onClose();
  };

  return (
    <>
      <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
        <span className="text-sm font-medium text-foreground truncate">
          {fullName || '(unnamed)'}
        </span>
        {lifespan && (
          <span className="text-[11px] text-muted-foreground">{lifespan}</span>
        )}
      </DropdownMenuLabel>

      <DropdownMenuSeparator />

      {/* Navigate group */}
      <DropdownMenuItem onSelect={onClose}>
        <Eye />
        <span>View details</span>
      </DropdownMenuItem>
      <RoleGate permission="person:edit">
        <DropdownMenuItem
          onSelect={() => {
            router.push(`/persons/${person.id}?view=record`);
            onClose();
          }}
        >
          <Pencil />
          <span>Edit person</span>
          <DropdownMenuShortcut>{formatShortcut('E')}</DropdownMenuShortcut>
        </DropdownMenuItem>
      </RoleGate>
      <DropdownMenuItem
        onSelect={() => {
          router.push(`/persons/${person.id}?view=board`);
          onClose();
        }}
      >
        <FlaskConical />
        <span>Research this person</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      {/* Add relation submenu */}
      <RoleGate permission="family:create">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <UserPlus />
            <span>Add relation</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-44">
            {ADD_RELATION_GROUPS.map(({ relation, label }) => (
              <DropdownMenuSub key={relation}>
                <DropdownMenuSubTrigger>
                  <span>{label}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-40">
                  <RoleGate permission="family:create">
                    <DropdownMenuItem
                      onSelect={() => requestAddRelation('link', relation)}
                    >
                      <span>Link existing…</span>
                    </DropdownMenuItem>
                  </RoleGate>
                  <RoleGate permission="person:create">
                    <DropdownMenuItem
                      onSelect={() => requestAddRelation('create', relation)}
                    >
                      <span>+ New person</span>
                    </DropdownMenuItem>
                  </RoleGate>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </RoleGate>

      <DropdownMenuSeparator />

      {/* Focus / filter */}
      <DropdownMenuItem
        onSelect={() => {
          onFocusOnPerson(person.id);
          onClose();
        }}
      >
        <Target />
        <span>Focus on person</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          onSetTopologyAnchor(person, 'ancestors');
          onClose();
        }}
      >
        <ArrowUpToLine />
        <span>Show ancestors only</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          onSetTopologyAnchor(person, 'descendants');
          onClose();
        }}
      >
        <ArrowDownToLine />
        <span>Show descendants only</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          router.push(`/tree?view=table&topologyAnchor=${person.id}`);
          onClose();
        }}
      >
        <Table2 />
        <span>See in table view</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      {/* Sharing / utility */}
      <DropdownMenuItem
        onSelect={async () => {
          try {
            await navigator.clipboard.writeText(person.id);
            toast.success('Person ID copied');
          } catch {
            toast.error('Could not copy to clipboard');
          }
          onClose();
        }}
      >
        <Hash />
        <span>Copy person ID</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={async () => {
          try {
            const link = `${window.location.origin}/persons/${person.id}`;
            await navigator.clipboard.writeText(link);
            toast.success('Share link copied');
          } catch {
            toast.error('Could not copy to clipboard');
          }
          onClose();
        }}
      >
        <Link2 />
        <span>Copy share link</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          window.open(`/persons/${person.id}`, '_blank', 'noopener,noreferrer');
          onClose();
        }}
      >
        <ExternalLink />
        <span>Open in new tab</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      {/* Destructive */}
      <RoleGate permission="person:delete">
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            onRequestDeletePerson(person.id);
            // Don't onClose() — the AlertDialog mount supersedes the menu;
            // closing here would race the dialog open.
          }}
        >
          <Trash2 />
          <span>Delete person…</span>
        </DropdownMenuItem>
      </RoleGate>
    </>
  );
}

// ---------------------------------------------------------------------------
// Multi-select menu (n >= 2)
// ---------------------------------------------------------------------------

function MultiSelectItems({
  trigger,
  onClose,
  onRequestBulkDelete,
  onExportSelection,
}: TreeContextMenuProps & { trigger: ContextMenuTrigger }) {
  const ids = trigger.selectionIds;
  return (
    <>
      <DropdownMenuLabel className="px-2 py-1.5">
        <span className="text-sm font-medium text-foreground">
          Selected ({ids.length}) people
        </span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <RoleGate permission="tree:export">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download />
            <span>Bulk export</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-32">
            {(['png', 'svg', 'pdf'] as const).map((fmt) => (
              <RoleGate key={fmt} permission="tree:export">
                <DropdownMenuItem
                  onSelect={() => {
                    onExportSelection(fmt);
                    onClose();
                  }}
                >
                  <span>{fmt.toUpperCase()}</span>
                </DropdownMenuItem>
              </RoleGate>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </RoleGate>
      <DropdownMenuSeparator />
      <RoleGate permission="person:delete">
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => onRequestBulkDelete(ids)}
        >
          <Trash2 />
          <span>Delete {ids.length} people…</span>
        </DropdownMenuItem>
      </RoleGate>
    </>
  );
}

// ---------------------------------------------------------------------------
// Edge menu
// ---------------------------------------------------------------------------

function EdgeItems({
  surface,
  onClose,
  onDeleteRelationship,
}: TreeContextMenuProps & {
  surface: {
    kind: 'edge';
    edgeId: string;
    edgeFamilyId?: string;
  };
}) {
  // Note: the previously-considered "Edit relationship details" item
  // (router.push(`/families/${familyId}`)) was dropped — only an API
  // route exists at /api/families/[id]; there's no UI page, so the
  // navigation would 404. Re-add this when a families/[id] page lands.
  return (
    <>
      <RoleGate permission="family:delete">
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            onDeleteRelationship(surface.edgeId);
            onClose();
          }}
        >
          <Trash2 />
          <span>Delete relationship</span>
        </DropdownMenuItem>
      </RoleGate>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pane (empty canvas) menu
// ---------------------------------------------------------------------------

function PaneItems({
  onClose,
  onFitView,
  onResetZoom,
  onToggleMinimap,
  onAddPerson,
}: TreeContextMenuProps) {
  return (
    <>
      <RoleGate permission="person:create">
        <DropdownMenuItem
          onSelect={() => {
            onAddPerson();
            onClose();
          }}
        >
          <UserPlus />
          <span>Add person</span>
        </DropdownMenuItem>
      </RoleGate>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => {
          onFitView();
          onClose();
        }}
      >
        <Maximize />
        <span>Fit view</span>
        <DropdownMenuShortcut>{formatShortcut('F')}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          onResetZoom();
          onClose();
        }}
      >
        <RefreshCw />
        <span>Reset zoom</span>
        <DropdownMenuShortcut>{formatShortcut('0')}</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          onToggleMinimap();
          onClose();
        }}
      >
        <MapIcon />
        <span>Toggle minimap</span>
        <DropdownMenuShortcut>{formatShortcut('Mod M')}</DropdownMenuShortcut>
      </DropdownMenuItem>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLifespan(p: PersonListItem): string | null {
  // PersonListItem has birth/death year fields shaped per @ancstra/shared.
  // Be permissive — different builds may expose these as `birthYear`,
  // `birth_year`, or nested under `vitals`. Probe defensively.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = p as any;
  const birth =
    any.birthYear ?? any.birth_year ?? any.vitals?.birthYear ?? null;
  const death =
    any.deathYear ?? any.death_year ?? any.vitals?.deathYear ?? null;
  if (!birth && !death) return null;
  return `${birth ?? '?'} – ${death ?? (p.isLiving ? '' : '?')}`.trim();
}

