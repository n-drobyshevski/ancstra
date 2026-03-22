# Relationship Validation

> Phase: 2 | Status: Not Started
> Depth: implementation-ready
> Dependencies: [Data Model](../architecture/data-model.md), [Record Matching](record-matching.md)
> Data model: [data-model.md — proposed_relationships, relationship_justifications](../architecture/data-model.md)

## Overview

The relationship validation workflow is the core data-integrity feature. AI systems and external APIs (FamilySearch, record matching) auto-discover potential relationships, but **only editors can confirm them into the tree**. This ensures genealogical accuracy and gives users visibility into how relationships entered the database.

Key principle: **GEDCOM imports write directly to families/children (assumed correct). All other sources create proposed_relationships entries pending editor validation.**

## Requirements

- [ ] Collect relationship proposals from multiple sources (FamilySearch API, record matching engine, AI entity extraction, user suggestions)
- [ ] Display a validation queue sorted by confidence (highest first)
- [ ] Show both persons involved, their existing relationships, and supporting evidence
- [ ] Allow editors to validate, reject, or request more information
- [ ] When validated, create family/children record with validation_status='confirmed'
- [ ] When validated, create relationship_justification with editor's evidence explanation
- [ ] Track which proposal led to which confirmed relationship
- [ ] Allow editors to add justifications to pre-existing confirmed relationships (e.g., GEDCOM imports)
- [ ] Log all validation decisions to change log and activity feed
- [ ] Display relationship validation status in tree visualization (solid, dashed, dotted lines)

## Design

### Data Collection Phase

All automated discovery systems create entries in `proposed_relationships`:

```
FamilySearch API hints     ──┐
Record matching engine     ──┤
AI entity extraction (OCR) ──┼──→ proposed_relationships (status: 'pending')
AI research assistant      ──┤
Newspaper search           ──┘
```

**Important constraint:** These sources **never** directly modify `families` or `children` tables. The sole exception is GEDCOM imports, which write directly with `validation_status = 'confirmed'` (trusted as input from user's existing genealogy software).

### proposed_relationships Schema

```typescript
// Data model extract from Section 2.2

CREATE TABLE proposed_relationships (
  id TEXT PRIMARY KEY,

  // What relationship is proposed
  relationship_type TEXT NOT NULL CHECK (
    relationship_type IN ('parent_child', 'partner', 'sibling')
  ),
  person1_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  person2_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,

  // Where did this proposal come from?
  source_type TEXT NOT NULL CHECK (source_type IN (
    'familysearch', 'nara', 'ai_suggestion', 'record_match', 'ocr_extraction', 'user_proposal'
  )),
  source_detail TEXT,           // e.g., FamilySearch record ID, match candidate ID
  confidence REAL,              // 0-1 from matching engine or AI

  // Validation state
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'validated', 'rejected', 'needs_info')
  ) DEFAULT 'pending',
  validated_by TEXT,            // user_id of editor who validated
  validated_at TEXT,
  rejection_reason TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

// Editor-provided evidence for each relationship link
CREATE TABLE relationship_justifications (
  id TEXT PRIMARY KEY,

  // Which relationship does this justify? (exactly one must be set)
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  child_link_id TEXT REFERENCES children(id) ON DELETE CASCADE,

  // Justification content
  justification_text TEXT NOT NULL,

  // Optional linked source citation (birth cert, census record, etc.)
  source_citation_id TEXT REFERENCES source_citations(id),

  // Who provided this justification
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  CHECK (
    (family_id IS NOT NULL AND child_link_id IS NULL) OR
    (family_id IS NULL AND child_link_id IS NOT NULL)
  )
);
```

### Validation Queue

The validation queue displays all pending proposals, sorted by confidence (highest first):

```typescript
// apps/web/app/(auth)/validate/page.tsx

interface ValidationQueueItem {
  proposalId: string;
  relationshipType: 'parent_child' | 'partner' | 'sibling';
  person1: {
    id: string;
    name: string;
    birthYear?: number;
    deathYear?: number;
    photoUrl?: string;
  };
  person2: {
    id: string;
    name: string;
    birthYear?: number;
    deathYear?: number;
    photoUrl?: string;
  };
  sourceSystem: string;          // 'familysearch', 'record_match', etc.
  confidence: number;            // 0-1
  existingRelationships: {
    person1: RelationshipSummary[];
    person2: RelationshipSummary[];
  };
  supportingEvidence: object;    // Varies by source system
  createdAt: string;
}

export function ValidationQueuePage() {
  const { data: queue } = useQuery({
    queryKey: ['validation-queue'],
    queryFn: () => fetch('/api/relationships/proposed?status=pending').then(r => r.json()),
    refetchInterval: 30_000,  // Refresh every 30 seconds
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {queue?.length} proposals pending validation
      </div>
      {queue?.map(item => (
        <ValidationQueueItem key={item.proposalId} item={item} />
      ))}
    </div>
  );
}

interface ValidationQueueItemProps {
  item: ValidationQueueItem;
}

function ValidationQueueItem({ item }: ValidationQueueItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-4 border rounded-lg bg-card">
      {/* Header with persons and confidence */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PersonAvatar person={item.person1} size="sm" />
          <span className="font-medium">{item.person1.name}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {item.relationshipType === 'parent_child' ? '←→' :
           item.relationshipType === 'partner' ? '💍' : '👥'}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.person2.name}</span>
          <PersonAvatar person={item.person2} size="sm" />
        </div>
        <span className="text-sm font-semibold">
          {Math.round(item.confidence * 100)}%
        </span>
      </div>

      {/* Expandable evidence section */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm text-primary mb-2"
      >
        {isOpen ? '▼' : '▶'} Evidence from {item.sourceSystem}
      </button>
      {isOpen && (
        <div className="p-3 bg-muted rounded text-sm mb-4">
          <pre className="text-xs overflow-auto">
            {JSON.stringify(item.supportingEvidence, null, 2)}
          </pre>
        </div>
      )}

      {/* Existing relationships for context */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="p-2 bg-muted/50 rounded">
          <div className="font-semibold text-xs mb-2">
            {item.person1.name}'s other relationships:
          </div>
          {item.existingRelationships.person1.length === 0 ? (
            <span className="text-muted-foreground text-xs">None</span>
          ) : (
            <ul className="space-y-1">
              {item.existingRelationships.person1.map(rel => (
                <li key={rel.personId} className="text-xs">
                  {rel.type}: {rel.otherPersonName}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-2 bg-muted/50 rounded">
          <div className="font-semibold text-xs mb-2">
            {item.person2.name}'s other relationships:
          </div>
          {item.existingRelationships.person2.length === 0 ? (
            <span className="text-muted-foreground text-xs">None</span>
          ) : (
            <ul className="space-y-1">
              {item.existingRelationships.person2.map(rel => (
                <li key={rel.personId} className="text-xs">
                  {rel.type}: {rel.otherPersonName}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleValidate(item.proposalId)}
          className="btn btn-primary btn-sm"
        >
          ✓ Validate
        </button>
        <button
          onClick={() => handleReject(item.proposalId)}
          className="btn btn-secondary btn-sm"
        >
          ✗ Reject
        </button>
        <button
          onClick={() => handleNeedsInfo(item.proposalId)}
          className="btn btn-outline btn-sm"
        >
          ? Needs Info
        </button>
      </div>
    </div>
  );
}
```

### Editor Decision Flow

```
Editor reviews proposed relationship
  |
  ├── VALIDATE
  │   |
  │   v
  │   Validation Modal:
  │   - Free text: "This matches census records 1870, 1880, and marriage license"
  │   - Checkbox: Link to source citation (optional)
  │   - Button: "Confirm this relationship"
  │   |
  │   v
  │   System (Transaction):
  │   - Creates family or children record
  │   - Sets validation_status = 'confirmed'
  │   - Links proposed_relationship_id for provenance
  │   - Creates relationship_justification record
  │   - Sets proposed_relationships.status = 'validated'
  │   - Logs change and notifies user
  │   - Updates tree visualization
  │
  ├── REJECT
  │   |
  │   v
  │   Rejection Modal:
  │   - Text field: "Why reject? (e.g., already married, wrong time period)"
  │   - Button: "Reject this proposal"
  │   |
  │   v
  │   System:
  │   - Sets proposed_relationships.status = 'rejected'
  │   - Sets rejection_reason
  │   - Relationship DOES NOT appear in tree
  │   - Logged in activity feed
  │
  └── NEEDS INFO
      |
      v
      Needs Info Modal:
      - Text field: "What additional info needed? (e.g., verify dates, find marriage license)"
      - Button: "Mark as needs research"
      |
      v
      System:
      - Sets proposed_relationships.status = 'needs_info'
      - Stays in queue with "needs research" badge
      - Can be reassigned to AI assistant for deeper investigation
```

### Validation API

```typescript
// apps/web/app/api/relationships/proposed/[id]/validate/route.ts

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!hasRole(session, 'editor')) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { justificationText, sourceCitationId } = await request.json();

  try {
    await db.transaction(async (tx) => {
      // 1. Get the proposed relationship
      const proposal = await tx.select().from(proposedRelationships)
        .where(eq(proposedRelationships.id, params.id))
        .get();

      if (!proposal || proposal.status !== 'pending') {
        throw new Error('Proposal not found or already processed');
      }

      // 2. Detect conflict: does either person already have this relationship?
      const existingLink = await detectRelationshipConflict(tx, proposal);
      if (existingLink) {
        throw new Error(
          `Conflict: ${proposal.person1_id} and ${proposal.person2_id} ` +
          `already linked as ${existingLink.type}`
        );
      }

      // 3. Create the actual relationship (family or children record)
      let familyId: string | undefined;
      let childLinkId: string | undefined;

      if (proposal.relationship_type === 'partner') {
        // Create family record
        const family = await tx.insert(families).values({
          partner1_id: proposal.person1_id,
          partner2_id: proposal.person2_id,
          validation_status: 'confirmed',
          proposed_relationship_id: proposal.id,
        }).returning();
        familyId = family[0].id;

      } else if (proposal.relationship_type === 'parent_child') {
        // person1 = parent, person2 = child
        // Find or create family for the parent
        const family = await findOrCreateParentFamily(tx, proposal.person1_id);

        const child = await tx.insert(children).values({
          family_id: family.id,
          person_id: proposal.person2_id,
          validation_status: 'confirmed',
          proposed_relationship_id: proposal.id,
        }).returning();
        childLinkId = child[0].id;

      } else if (proposal.relationship_type === 'sibling') {
        // Find parent(s) shared by both persons
        const parentFamily = await findSharedParentFamily(
          tx,
          proposal.person1_id,
          proposal.person2_id
        );

        if (!parentFamily) {
          // No shared parent family; create one (implies common parent unspecified)
          const commonParent = await createUnspecifiedPerson(tx, 'Parent of ' + proposal.person1_id);
          const newFamily = await tx.insert(families).values({
            partner1_id: commonParent.id,
            validation_status: 'confirmed',
          }).returning();

          // Add both as children
          await tx.insert(children).values([
            {
              family_id: newFamily[0].id,
              person_id: proposal.person1_id,
              validation_status: 'confirmed',
              proposed_relationship_id: proposal.id,
            },
            {
              family_id: newFamily[0].id,
              person_id: proposal.person2_id,
              validation_status: 'confirmed',
              proposed_relationship_id: proposal.id,
            }
          ]);
          familyId = newFamily[0].id;
        }
      }

      // 4. Create the justification
      await tx.insert(relationshipJustifications).values({
        family_id: familyId,
        child_link_id: childLinkId,
        justification_text: justificationText,
        source_citation_id: sourceCitationId || null,
        author_id: session.user.id,
      });

      // 5. Mark proposal as validated
      await tx.update(proposedRelationships)
        .set({
          status: 'validated',
          validated_by: session.user.id,
          validated_at: new Date().toISOString(),
        })
        .where(eq(proposedRelationships.id, params.id));

      // 6. Log the change
      await logChange(tx, 'proposed_relationship', proposal.id, 'update', {
        status: { old: 'pending', new: 'validated' },
      }, session.user.id);
    });

    return Response.json({ success: true });

  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
```

### Reject Proposal

```typescript
// apps/web/app/api/relationships/proposed/[id]/reject/route.ts

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!hasRole(session, 'editor')) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { rejectionReason } = await request.json();

  await db.transaction(async (tx) => {
    const proposal = await tx.select().from(proposedRelationships)
      .where(eq(proposedRelationships.id, params.id))
      .get();

    if (!proposal || proposal.status !== 'pending') {
      throw new Error('Proposal not found or already processed');
    }

    await tx.update(proposedRelationships)
      .set({
        status: 'rejected',
        rejection_reason: rejectionReason,
        validated_by: session.user.id,
        validated_at: new Date().toISOString(),
      })
      .where(eq(proposedRelationships.id, params.id));

    await logChange(tx, 'proposed_relationship', proposal.id, 'update', {
      status: { old: 'pending', new: 'rejected' },
      rejection_reason: rejectionReason,
    }, session.user.id);
  });

  return Response.json({ success: true });
}
```

### Adding Justifications to Existing Links

Editors can add justifications to relationships already in the tree (e.g., from GEDCOM import) to strengthen the evidence chain:

```typescript
// POST /api/relationships/:familyId/justifications
// or POST /api/children/:childLinkId/justifications

export async function POST(
  request: Request,
  { params }: { params: { familyId?: string; childLinkId?: string } }
) {
  const session = await getSession();
  if (!hasRole(session, 'editor')) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { justificationText, sourceCitationId } = await request.json();

  // Insert justification without changing validation status
  // Multiple justifications per relationship allowed
  // Each can reference a different source citation

  await db.insert(relationshipJustifications).values({
    family_id: params.familyId || null,
    child_link_id: params.childLinkId || null,
    justification_text: justificationText,
    source_citation_id: sourceCitationId || null,
    author_id: session.user.id,
  });

  return Response.json({ success: true });
}
```

## Tree Visualization Integration

As detailed in the tree-visualization spec, relationship validation status appears visually:

- **Confirmed relationships:** Solid line, default color
- **Proposed relationships:** Dashed line, blue color
- **Disputed relationships:** Dotted line, amber color

Person nodes with pending proposals show a notification dot. Clicking a relationship link opens the justification panel showing all evidence.

## Edge Cases & Error Handling

- **Circular relationship:** Person A parent of B, B parent of A. Detect and reject.
- **Conflicting proposals:** Two different proposals for person A being parent of B with different person C. Show both; let editor decide.
- **Duplicate proposals:** Same proposal from multiple sources. Deduplicate by (person1_id, person2_id, relationship_type); keep highest confidence.
- **Invalid person IDs:** Proposal references deleted person. Skip or warn.
- **Race condition:** Editor A validates while Editor B is editing same proposal. Use transaction isolation.
- **Source data inconsistent:** Proposal says parent_child but persons are 10 years apart. Warn but allow override (with editor justification).

## Open Questions

1. **Should we support "sibling" relationship explicitly?** Currently: yes, but implementation is complex (requires parent). Consider simplifying to "related" generic relationship?

2. **Should AI auto-generate justifications for validated proposals?** Currently: editor writes justification. Could Claude summarize evidence as draft?

3. **Should we allow bulk rejection?** Currently: single proposal at a time. Consider batch actions for efficiency?

4. **How long to keep rejected proposals?** Currently: stored forever. Archive or delete after N days?

## Implementation Notes

**Phase 2 deliverables:**
- proposed_relationships and relationship_justifications tables
- Validation queue UI
- Validate/Reject/Needs Info modals
- Validation API routes
- Conflict detection logic
- Integration with tree visualization (link styles, badge)
- Activity feed logging
- Change log entries

**Libraries to use:**
- React Hook Form (validation modals)
- Zustand (modal state)
- Drizzle ORM transactions

**Test coverage:**
- Proposal creation from various sources
- Conflict detection (circular refs, existing relationships)
- Validation workflow (validate → create family/children)
- Rejection workflow (reject → no tree change)
- Needs info workflow (mark for later research)
- Justification storage and retrieval
- Tree visualization updates after validation
- Race condition handling (concurrent edits)
- Bulk operations (if supported)
