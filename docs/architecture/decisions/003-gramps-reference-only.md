# ADR-003: Gramps as Reference, Not Runtime Dependency

> Date: 2026-03-21 | Status: Accepted

## Context

Gramps (Genealogical Research and Analysis Management System) is a mature open-source genealogy application with 20+ years of development. Its data model, validation rules, and GEDCOM handling are battle-tested. The initial question: should we use Gramps Web API as a runtime dependency for our data layer?

Gramps Web API offers:
- A complete genealogy data model (persons, families, events, sources, citations, media, etc.)
- Validation rules and constraints
- GEDCOM import/export built-in
- A RESTful API to that model

The attractive option would be: wrap Gramps Web API and avoid rebuilding the genealogy data layer from scratch.

## Decision

**Do NOT use Gramps Web API as a runtime dependency. Study Gramps' schema design and validation rules as reference when designing our own TypeScript data layer.**

Specifically:
- Do NOT depend on Gramps' Python runtime (`gramps-web-server`)
- DO read Gramps' schema design (event-based modeling, place hierarchy, source citations, structured names)
- DO implement our own TypeScript-native data model in Drizzle ORM, borrowing Gramps concepts where appropriate
- DO maintain full schema ownership and control

## Reasons

1. **ADR-001 constraint:** Adding Gramps Web API as a dependency violates ADR-001 (JS/TS over Python). Gramps Web API is Python FastAPI; it requires a Python runtime and adds operational overhead.

2. **Schema lock-in:** Gramps' schema is tightly coupled to its Python data model. Extending or modifying it to Ancstra's needs (e.g., proposed relationships, relationship justifications) requires forking or monkey-patching.

3. **Full control required:** Genealogy data is the heart of the app. Owning the schema design means:
   - Easy add/modify columns without Gramps release cycles
   - Clear understanding of every constraint and trigger
   - Ability to optimize for Ancstra's specific features (validation workflow, AI suggestions, etc.)

4. **Redundancy:** Gramps Web API adds a layer of abstraction over its schema, but we're building on top of that abstraction anyway with our own business logic. Better to go directly to SQL.

5. **Maintenance burden:** Gramps is maintained by volunteers; Ancstra is solo development. Depending on Gramps Web API API stability, version mismatches, and breaking changes introduces risk.

6. **Learnability:** Building the data layer ourselves is an opportunity to deeply understand genealogy data structures, which pays off in feature quality.

## Consequences

1. **More upfront schema design work:** Instead of inheriting Gramps' schema, we design our own. The research doc (Section 2.2) provides a starting schema with:
   - Event-based life event modeling (borrowed from Gramps' concept)
   - Place hierarchy and normalization (same as Gramps)
   - Source citations and structured names (Gramps-inspired)
   - Proposed relationships workflow (Ancstra-specific enhancement)
   - Relationship justifications (Ancstra-specific for validation)

2. **Schema maintenance is our responsibility:** We own all migrations, constraints, and validation rules. This is actually good — no surprises from Gramps updates.

3. **Custom GEDCOM parsing required:** We can't delegate GEDCOM parsing to Gramps. Section 3 details our approach:
   - Use Topola for core parsing (library, not requiring Gramps)
   - Implement vendor dialect handling ourselves
   - Custom import transaction safety

4. **No built-in validation rules from Gramps:** We define our own validation rules for:
   - Person → name consistency
   - Event dates
   - Place hierarchy
   - Relationship constraints (e.g., can't be parent and child)
   - Implemented in database constraints + application code

---

## Gramps Design Elements We *Do* Borrow

To avoid reinventing genealogy, these Gramps concepts are adopted:

### 1. Event-Based Modeling
**Gramps approach:** Life events (birth, death, marriage, etc.) are separate entities, not columns on a person table. Each event can have:
- Type (birth, death, marriage, burial, baptism, etc.)
- Date (with modifiers: exact, about, estimated, range, etc.)
- Place (normalized hierarchy)
- Description
- Source citations

**Ancstra schema:** Exactly mirrors this in the `events` table (Section 2.2).

### 2. Place Hierarchy
**Gramps approach:** Places are recursive (city → county → state → country), enabling:
- Deduplication (Springfield, IL vs. Springfield, MA are different)
- Geocoding (lookup coordinates for each place)
- Historical place names (e.g., Prussia vs. modern Germany)

**Ancstra schema:** `places` table with `parent_place_id` and FamilySearch place authority integration.

### 3. Source Citations
**Gramps approach:** Every fact is linked to a source citation. A citation references:
- A source (book, website, repository)
- Citation details (page number, entry number, etc.)
- Confidence level (high, medium, low)
- The entity being cited (polymorphic: person, event, name, etc.)

**Ancstra schema:** `sources` and `source_citations` tables (Section 2.2) with polymorphic linking.

### 4. Structured Names
**Gramps approach:** Names are decomposed into:
- Given name(s)
- Surname
- Prefix (Dr., Rev.)
- Suffix (Jr., III, Sr.)
- Nickname
- Name type (birth, married, aka, immigrant, religious)

**Ancstra schema:** `person_names` table with identical structure.

### 5. Relationship Types
**Gramps approach:** Relationships are explicitly typed:
- Family relationship types: married, civil_union, domestic_partner, unmarried, unknown
- Child relationship types: biological, adopted, foster, step, unknown

**Ancstra schema:** Same enums in `families.relationship_type` and `children.relationship_to_parent*` columns.

---

## What We *Don't* Borrow

Gramps features we intentionally skip (too much scope for MVP):
- Media embedding and tagging (scope: manage file paths, OCR results; media content is user's responsibility)
- Calendar system (Gramps has custom date parser for non-Gregorian calendars; TS library suffices)
- Database integrity checks (Gramps has formal validation; ours is pragmatic database constraints + code)
- Report generation (Gramps has extensive reporting; Ancstra defers to Topola for charts)
- Plugin system (Gramps is extensible; Ancstra is more opinionated on features)

---

## Implementation Approach

### Phase 1: Core Schema (Section 2.2)

Use Drizzle ORM with these design principles:
- **NOT NULL constraints** on required fields
- **CHECK constraints** on enums (relationship_type, event_type, etc.)
- **FOREIGN KEY constraints** with appropriate ON DELETE actions
- **Indexes** on common lookups (person ID, family ID, event type, etc.)

### Phase 1: GEDCOM Parser (Section 3)

Implement GEDCOM import using:
- **Topola** library for core parsing (JavaScript/TypeScript, maintained)
- **Custom dialect detection** for Ancestry, RootsMagic, Legacy, FamilySearch, etc.
- **Field mapping** from GEDCOM tags → our schema columns
- **Transaction safety** to ensure partial imports are rolled back

### Ongoing: Validation Rules

As features add requirements (e.g., multi-user validation workflow), add:
- Database triggers for consistency
- Application-level validation in Drizzle queries
- Change logging for audit trail

---

## Revisit Triggers

1. **GEDCOM complexity beyond scope:** If vendor GEDCOM dialects require 100+ lines of custom code, evaluate whether using Topola + Gramps' parser together (subprocess call) is justified.

2. **Need Gramps-compatible export:** If users ask for import/export with Gramps itself (not just GEDCOM), consider Gramps as reference for serialization format (not runtime dependency).

3. **Significant validation gaps discovered:** If validation rules prove difficult to implement correctly, publish a spec for community contribution (crowdsource validation logic from genealogy experts).

---

## Related Decisions

- **ADR-001:** JS/TS over Python (consequence: no Gramps Web API dependency)
- **ADR-002:** SQLite with Drizzle (consequence: own schema design required, not inherited from Gramps)
