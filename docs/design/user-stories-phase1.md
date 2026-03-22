# Phase 1: User Stories for Core Manual Tree Builder

## Personas

### Margaret — Dedicated Genealogy Researcher (Primary)
- **Age:** 55-70
- **Background:** Passionate genealogist with 10-20 years of research experience, has accumulated GEDCOM files from multiple sources
- **Pain points:** Wants complete data ownership, doesn't trust cloud storage with family data, needs proper source citations and evidence management
- **Goals:** Build a comprehensive family tree with proper documentation, export clean GEDCOM files, preserve research work for family legacy
- **Tech comfort:** Moderate to high — comfortable with file management, imports/exports, understands GEDCOM format

### Alex — Family Historian for Kids (Secondary)
- **Age:** 30-45
- **Background:** Documenting family history for children/grandchildren, wants visual and engaging presentation
- **Pain points:** Finds genealogy tools confusing with too many features, wants ease of data entry, prefers guided workflows
- **Goals:** Build a family tree to preserve history, create shareable (but private) visualization, tell family stories
- **Tech comfort:** Moderate — comfortable with web apps, prefers intuitive interfaces over technical depth

### Jordan — Curious DNA Explorer (Tertiary)
- **Age:** 20-35
- **Background:** Took DNA test, fascinated by ethnicity/family connections, relatively new to genealogy
- **Pain points:** Overwhelmed by genealogy research complexity, wants immediate visual gratification, doesn't know where to start
- **Goals:** Explore distant cousins, visualize family tree, understand ancestry breakdown, have fun discovering family
- **Tech comfort:** High — digital native, comfortable with modern web interfaces

---

## Epic: Person Management

Core functionality for creating, viewing, updating, and managing individual family members.

### Story 1.1: Create New Person (Manual Entry)
**As a** Margaret
**I want to** create a new person in my family tree by filling out a form with basic information
**So that** I can start building my tree from scratch without importing a GEDCOM file

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Form includes fields for: given name, surname, sex (M/F/U), birth date, birth place, notes
- Form validates that name fields are not empty before submission
- New person is saved to database with auto-generated ID
- User is redirected to person detail page after creation
- Form is accessible from main navigation ("Add Person" button)

---

### Story 1.2: View Person Details
**As a** Alex
**I want to** view a person's complete information in a detail panel including name, dates, places, and relationships
**So that** I can review all known information about a person and see how they connect to others

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Detail panel displays: full name, sex, birth/death dates and places, notes
- Relationships section shows spouse(s), parents, and children with clickable links
- Detail panel can be opened from tree view or search results
- Detail panel shows "Edit" button to modify person information
- Living-person indicator displays when applicable (born within 100 years, no death date)

---

### Story 1.3: Edit Person Information
**As a** Margaret
**I want to** edit a person's details including name variants, dates, places, and notes
**So that** I can correct errors and add new research findings

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Edit form pre-fills with current person data
- Form allows updating: given name, surname, sex, birth/death dates/places, notes
- Date fields accept partial dates (year-only, month-year, or full date)
- Form validates dates (death after birth, reasonable dates within 200 years)
- Save button updates database and returns to detail view
- Edit changes are reflected immediately in search and tree views

---

### Story 1.4: Delete Person (Soft Delete)
**As a** Margaret
**I want to** remove a person from my tree
**So that** I can clean up duplicate or incorrect entries

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Delete confirmation dialog prevents accidental deletion
- Deleted persons are soft-deleted (marked deleted_at timestamp, not permanently removed)
- Soft-deleted persons do not appear in tree views or search results by default
- Family relationships referencing deleted persons are handled gracefully
- Admin option to restore soft-deleted persons exists

---

### Story 1.5: Add Name Variants
**As a** Margaret
**I want to** add alternative names for a person (maiden name, nickname, immigrant name)
**So that** I can track how someone was known under different names across documents

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Person can have multiple names with types: birth, married, aka, immigrant, religious
- One name is marked as "primary" for display purposes
- All names are searchable via full-text search
- Name variants show in person detail under alternate names section

---

### Story 1.6: Add Birth Event
**As a** Margaret
**I want to** record a person's birth as a structured event with date, place, and source citations
**So that** I can track birth details with proper documentation

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Birth event form includes: date (with precision: exact/about/before/after), place with hierarchy, description
- User can attach a source citation (certificate, book, etc.) to the birth event
- Birth event appears in person's chronological event list
- Birth date from first birth event can populate person's main birth_date field

---

### Story 1.7: Add Death Event
**As a** Margaret
**I want to** record a person's death with date, place, and burial information
**So that** I can document when they died and ensure they're not filtered as "living"

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Death event form includes: date, place, cause (optional), description
- Death event marks person as not living (overrides living-status calculation)
- Death date from event populates person's main death_date field
- User can optionally add burial event linked to the death

---

### Story 1.8: Add Other Life Events
**As a** Margaret
**I want to** add other life events (occupation, residence, immigration, military service, etc.) to a person
**So that** I can document their life timeline comprehensively

**Priority:** COULD HAVE

**Acceptance Criteria:**
- Event creation form accepts event type from predefined list (occupation, residence, immigration, military, census, burial, etc.)
- Custom event types can be entered if predefined list doesn't match
- Events display chronologically in person detail
- Each event can have a source citation attached

---

### Story 1.9: Add and Manage Source Citations
**As a** Margaret
**I want to** create source citations and attach them to events or persons
**So that** I can document the evidence basis for each fact in my tree

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Source creation includes: title, author, repository, URL (optional)
- Source types supported: vital record, census, military, church, newspaper, immigration, book, online, other
- Multiple citations can link to a single source (e.g., same census record cited for multiple family members)
- Citation includes: page number/entry number, confidence level (high/medium/low), citation text
- Source appears in person detail with formatted citation

---

### Story 1.10: Add Photos and Documents
**As a** Alex
**I want to** attach photos and documents to persons or events
**So that** I can preserve family memories and documentary evidence

**Priority:** COULD HAVE

**Acceptance Criteria:**
- File upload supports: images (JPG, PNG), PDFs, and documents
- Media is attached to person, event, or source record
- Media gallery displays in person detail with title and description fields
- Metadata: upload date, original document date (optional)
- File storage respects privacy level (living persons' photos not shared in exports)

---

## Epic: Tree Visualization

Interactive visualization of family relationships to explore and navigate the tree.

### Story 2.1: Display Pedigree Chart View
**As a** Jordan
**I want to** see my family tree displayed as an interactive pedigree chart
**So that** I can visualize family relationships and see how people connect

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Pedigree chart renders persons as boxes and connections as lines
- Chart supports zoom in/out and pan controls
- Clicking a person on the chart opens their detail panel
- Chart centered on a selected root person (default to oldest ancestor)
- Chart handles multiple generations (at least 5 levels)

---

### Story 2.2: Switch Chart Type
**As a** Margaret
**I want to** view my family tree in different chart formats (pedigree, ancestor, descendant, hourglass)
**So that** I can explore relationships from different perspectives

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Chart type selector available in tree view (dropdown or tab buttons)
- Supported views: pedigree (default), ancestor chart (parents only), descendant chart (children only), hourglass (both directions)
- Switching chart types preserves selected root person
- Each chart type renders correctly with appropriate persons and connections

---

### Story 2.3: Select Different Root Person
**As a** Alex
**I want to** click on a person in the tree and re-center the chart on them
**So that** I can explore different branches of my family

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Click on any person in the chart to re-center on them
- Chart animates smoothly to new center person
- Breadcrumb shows current root person (e.g., "Margaret Smith > John Smith > James Smith")
- Search sidebar allows selecting root person by name

---

### Story 2.4: View Relationship Lines
**As a** Jordan
**I want to** see clear lines showing parent-child, spouse, and sibling relationships
**So that** I can understand how family members are related at a glance

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Marriage/partnership relationships shown as connecting line between spouses
- Parent-child relationships shown as line from parent box(es) to child box
- Sibling relationships optionally shown (same parents box connected to multiple children)
- Different line styles/colors distinguish relationship types (optional)
- Legend explains line meanings

---

### Story 2.5: Print Chart
**As a** Margaret
**I want to** print the family tree chart
**So that** I can share a paper copy with family members

**Priority:** COULD HAVE

**Acceptance Criteria:**
- Print button exports chart to PDF or sends to printer
- Printed chart maintains readability (tree not compressed to single page if large)
- Chart legend included in print output
- Privacy mode applies: living persons' names hidden if applicable
- Page layout optimized for portrait/landscape

---

### Story 2.6: Filter Chart by Generation
**As a** Alex
**I want to** show only certain generations in the chart (e.g., only grandparents and grandchildren)
**So that** I can focus on a specific family branch

**Priority:** COULD HAVE

**Acceptance Criteria:**
- Generation filter toggle or multi-select on tree view
- Options: ancestors only, descendants only, all generations, or select specific distance (e.g., +/- 2 generations from root)
- Chart updates immediately when filter changes

---

## Epic: GEDCOM Import/Export

Support for importing existing GEDCOM files and exporting tree data for portability.

### Story 3.1: Upload and Parse GEDCOM File
**As a** Margaret
**I want to** upload a GEDCOM file from my computer
**So that** I can import an existing family tree I've built in another program

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Import page has drag-and-drop zone or file picker for GEDCOM files
- System accepts .ged file extension (case-insensitive)
- File is validated before parsing (proper GEDCOM 5.5.1 structure check)
- Non-UTF-8 files are detected and converted to UTF-8 automatically
- Parser handles common vendor extensions (Gramps, FamilySearch, Ancestry dialects)
- User receives feedback if file parsing fails with clear error message

---

### Story 3.2: Show Import Progress
**As a** Margaret
**I want to** see progress as my GEDCOM file is being imported
**So that** I know the import is working and about how long it will take

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Progress bar shows file parsing progress (0-100%)
- Counter shows: "Parsing persons X/Y, found Z families"
- Estimated time remaining displayed
- User can cancel import in progress
- After import, summary shows: total persons, families, events imported

---

### Story 3.3: Detect and Show Import Conflicts
**As a** Margaret
**I want to** see conflicts if importing over an existing tree (duplicate persons, conflicting dates)
**So that** I can decide whether to merge, skip, or handle conflicts

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Pre-import scan detects potential duplicates (same name + similar dates)
- Conflict report shows: X potential duplicates, Y missing dates, Z orphaned persons
- User can choose to import with conflicts (merge duplicates) or cancel
- Merge rules documented: prefer newer data, preserve all sources, user can pick
- Conflict resolution UI allows manual selection for high-value conflicts

---

### Story 3.4: Import Summary and Validation
**As a** Margaret
**I want to** review import results and see any validation errors
**So that** I can verify the import succeeded and address any issues

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Import completion shows: total imported (persons, families, events, sources)
- Validation warnings listed (e.g., "5 persons with impossible dates", "10 orphaned children")
- Warnings are non-blocking (import succeeds but user is informed)
- User can view a sample of imported data or navigate to recently imported persons
- Option to undo/rollback the entire import if needed

---

### Story 3.5: Export Tree to GEDCOM
**As a** Margaret
**I want to** export my family tree to a GEDCOM file
**So that** I can share it with others or back it up for portability

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Export page accessible from menu ("Export Tree")
- Export generates valid GEDCOM 5.5.1 format file
- All persons, families, events, sources are included in export
- File download triggers in browser with sensible filename (e.g., "ancstra-export-2026-03-21.ged")
- Exported file is re-importable without data loss
- UTF-8 encoding with BOM for Windows compatibility

---

### Story 3.6: Privacy Mode: Full Tree Export
**As a** Margaret
**I want to** export my complete family tree including all living persons and details
**So that** I can create a private backup for my own records

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Privacy mode selector shows "Full Tree (Private)" option
- Full export includes: all persons (living and deceased), all events, all notes, all sources
- Preview shows: "X living persons included, Y private notes included"
- Download creates encrypted ZIP (optional) or unencrypted GEDCOM
- File is suitable for personal archival (on USB drive, cloud storage, etc.)

---

### Story 3.7: Privacy Mode: Shareable Tree Export
**As a** Alex
**I want to** export a privacy-protected version of my tree for sharing with cousins
**So that** I can share family history while protecting living persons' private information

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Privacy mode selector shows "Shareable Tree" option
- Living persons are obscured: name replaced with "Living [surname]", birth date hidden
- Recent events (last 100 years) associated with living persons are hidden
- Living persons' parentage stripped (privacy protection)
- Deceased ancestors (>100 years without death) included fully
- Preview shows what will be hidden/shown
- Warning: "Sharing this file reveals [X] deceased ancestors"

---

### Story 3.8: Privacy Mode: Ancestors-Only Export
**As a** Margaret
**I want to** export only my deceased ancestors for sharing with genealogists
**So that** I can collaborate on research without exposing living family

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Privacy mode selector shows "Ancestors Only" option
- Export includes only persons marked as deceased (death date exists)
- Persons presumed living (born <100 years ago, no death date) excluded
- No persons in current user's generation or younger included
- File suitable for genealogy forums or research collaboration

---

### Story 3.9: Preserve Name Variants and Maiden Names on Export
**As a** Margaret
**I want to** ensure that all name variations I've entered are preserved in GEDCOM export
**So that** I don't lose research about maiden names or alternate names

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- All person_names records exported as GEDCOM NAME variations
- Name type tags preserved: birth name, married name, aka, immigrant name
- Primary name exported as primary GEDCOM NAME tag
- Alternate names exported as additional NAME tags with internal reference
- Roundtrip verification: import exported GEDCOM, all names preserved identically

---

### Story 3.10: Preserve Sources and Citations on Export
**As a** Margaret
**I want to** ensure that all my source citations are preserved in GEDCOM export
**So that** my research documentation is portable

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- All sources exported as SOUR records with: title, author, repository
- All citations exported as SOUR references on persons, events, families
- Citation detail (page number, confidence) preserved in SOUR tags
- URLs preserved if present
- Source hierarchy maintained in GEDCOM structure

---

## Epic: Search & Navigation

Find and navigate between family members efficiently using search and filters.

### Story 4.1: Full-Text Search with Typeahead
**As a** Jordan
**I want to** search for a person by name in a search box with instant autocomplete results
**So that** I can quickly find someone in my tree without clicking through all menus

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Search box appears in main navigation and tree view
- Typing triggers typeahead with matching results (first 5-10 matches)
- Results show: given name, surname, birth/death years
- Clicking a result opens person detail panel
- Search is case-insensitive and handles accented characters
- Empty search shows no results; minimum 2 characters to trigger search

---

### Story 4.2: Advanced Search Filters
**As a** Margaret
**I want to** filter the tree by sex, generation, and living status
**So that** I can find specific groups of people (e.g., "all female ancestors")

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Filter panel on tree view with options: sex (M/F/U/all), generation (ancestors/descendants/all, with distance), living status (hide living/show all)
- Filters are cumulative (e.g., sex: female AND generation: ancestors)
- Apply filters updates tree view and sidebar person list
- Filter state persists during session (not reload persistence)
- "Clear filters" button resets all selections

---

### Story 4.3: Search Results List
**As a** Alex
**I want to** see search results displayed as a sortable list with name, dates, and relationships
**So that** I can scan multiple matches and pick the right person

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Search results table shows: name (given + surname), birth year, death year (if applicable), spouse(s), parents (if known)
- Results sortable by: name (A-Z), birth date (oldest/youngest)
- Click row to open person detail or select in tree
- Results pagination if >20 matches

---

### Story 4.4: View Recently Accessed Persons
**As a** Alex
**I want to** see a list of recently viewed people
**So that** I can quickly return to people I'm actively researching

**Priority:** COULD HAVE

**Acceptance Criteria:**
- Recent persons sidebar (or dropdown) shows last 10 accessed persons with names and dates
- Clicking a recent person opens their detail
- Recent list stored in localStorage (persists across sessions)
- Oldest entries drop off as new persons are viewed

---

### Story 4.5: Breadcrumb Navigation
**As a** Jordan
**I want to** see a breadcrumb showing my navigation path through the tree
**So that** I can understand where I am and navigate back to previous persons

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Breadcrumb displays above tree view: "Margaret Smith > John Smith > James Smith"
- Each breadcrumb segment is clickable and re-centers tree on that person
- Breadcrumb reflects current tree root person
- Breadcrumb updates when tree is re-centered on new person

---

### Story 4.6: Sidebar Tree Outline
**As a** Margaret
**I want to** see a collapsible family tree outline in the sidebar
**So that** I can navigate the tree structure hierarchically

**Priority:** COULD HAVE

**Acceptance Criteria:**
- Sidebar shows root person at top, expandable into parents, children, spouses
- Tree outline shows persons by generation with names and dates
- Expanding/collapsing generations updates tree view center
- Current selected person highlighted in outline
- Outline dynamically updates when persons are added/modified

---

## Epic: Dashboard & Onboarding

Welcome screen, project overview, and quick actions for new and returning users.

### Story 5.1: Dashboard with Stats Overview
**As a** Alex
**I want to** see a dashboard showing summary stats of my family tree
**So that** I can quickly see the size and scope of my project

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Dashboard displays: total persons, total families, total events, date range of tree (oldest/youngest)
- Shows: percentage of persons with birth/death dates, percentage with sources
- Quick stat cards with icons (e.g., "456 Persons", "123 Families")
- Dashboard is homepage or first page users see on login

---

### Story 5.2: Quick Actions on Dashboard
**As a** Margaret
**I want to** see quick action buttons on the dashboard for common tasks
**So that** I can jump into frequently-used features without navigating menus

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Dashboard includes buttons: "Add Person", "Import GEDCOM", "View Tree", "Export Tree"
- Buttons prominently displayed in a card or ribbon below stats
- Clicking buttons navigates to respective features
- Buttons show icons for visual clarity

---

### Story 5.3: Recent Activities
**As a** Margaret
**I want to** see a list of recent changes (new persons, edits, imports)
**So that** I can track what's been added to my tree recently

**Priority:** COULD HAVE

**Acceptance Criteria:**
- Dashboard shows activity timeline: last 10 changes (create/update), sorted newest first
- Each activity shows: date/time, action type (created/updated), person name, description
- Clicking activity navigates to affected person
- Activity data pulled from change_log table

---

### Story 5.4: Empty State Onboarding
**As a** Jordan
**I want to** see helpful guidance when I first load Ancstra with no data
**So that** I understand what to do next

**Priority:** MUST HAVE

**Acceptance Criteria:**
- Empty state page displays when no persons exist
- Shows: project title, brief explanation of app ("Family tree builder")
- Prominent action buttons: "Import GEDCOM" (if file available) and "Create First Person"
- Helpful text: "Start by importing an existing GEDCOM file or adding your first person"
- Link to help/tutorial documentation

---

### Story 5.5: First-Person Guided Creation
**As a** Jordan
**I want to** be guided through creating my first person with a simplified form
**So that** I can get started immediately without feeling overwhelmed

**Priority:** COULD HAVE

**Acceptance Criteria:**
- Simplified "First Person" form with only essential fields: given name, surname, birth year, sex
- Form has inline helper text for each field
- After creation, suggests next steps: "Add your parent" or "Add your spouse"
- Form includes a tooltip explaining why each field matters
- Progressively disclose optional fields (notes, sources, events) in collapsed section

---

### Story 5.6: Help and Documentation Links
**As a** Alex
**I want to** find help and tutorials from within the app
**So that** I can learn how to use features without leaving Ancstra

**Priority:** COULD HAVE

**Acceptance Criteria:**
- "Help" link in main navigation footer
- Help page includes links to: user guide, GEDCOM FAQ, privacy info, contact
- Context-specific help available (question mark icons on key UI elements)
- Clicking context help opens tooltip or sidebar help panel
- Links to external documentation (GitHub wiki, video tutorials if available)

---

### Story 5.7: Export/Backup Reminder
**As a** Margaret
**I want to** be reminded to back up my tree
**So that** I don't lose my data if something goes wrong

**Priority:** COULD HAVE

**Acceptance Criteria:**
- Dashboard shows notification if no export has been done in 30 days
- Notification is dismissible (user can snooze 7 days)
- Notification includes "Export Tree" quick button
- Last export date shown in dashboard (if known)

---

### Story 5.8: Settings and Privacy Preferences
**As a** Margaret
**I want to** configure privacy settings and app preferences
**So that** I can control how my data is handled and the app behaves

**Priority:** SHOULD HAVE

**Acceptance Criteria:**
- Settings page accessible from menu (gear icon or "Settings" link)
- Privacy settings: default export mode (full/shareable/ancestors-only), living-person threshold age
- UI preferences: theme (light/dark), default chart view, units (US/metric)
- Data settings: database location (local or Turso), auto-backup settings
- Settings persisted in database or localStorage

---

### Story 5.9: Profile/Account Management
**As a** Alex
**I want to** manage my account profile and authentication
**So that** I can control my login and user information

**Priority:** COULD HAVE

**Acceptance Criteria:**
- Profile page shows: username/email, created date, database size
- Option to change password (for local auth)
- Option to export all personal data (GDPR compliance)
- Option to delete account (soft delete, with grace period)
- Settings accessible from user menu (top-right avatar)

---

## Prioritization Summary

### Must Have (Phase 1 MVP)
- Person CRUD (create, view, edit)
- Display pedigree chart
- Select root person and re-center chart
- View relationship lines in chart
- GEDCOM import with progress and validation
- GEDCOM export (full privacy mode)
- Full-text search with typeahead
- Person detail panel with relationships
- Empty state onboarding

**Estimated Effort:** 8 weeks

---

### Should Have (Phase 1 Enhancement)
- Add birth/death/other events
- Add and manage sources
- Delete person (soft delete)
- Switch chart type (ancestor, descendant, hourglass)
- Detect import conflicts
- Shareable and ancestors-only export modes
- Advanced search filters
- Breadcrumb navigation
- Dashboard with stats and quick actions
- Settings and privacy preferences

**Estimated Effort:** 4-6 additional weeks (Phase 1.5)

---

### Could Have (Post-Phase 1)
- Add name variants
- Add photos/documents
- Print chart
- Filter chart by generation
- Other life events (occupation, residence, military, etc.)
- Recent activities timeline
- Recent persons list
- Sidebar tree outline
- First-person guided creation
- Help documentation
- Export/backup reminders
- Account management

**Estimated Effort:** Future phases

---

### Won't Have (Phase 1)
- AI-powered research features
- Record matching and discovery
- FamilySearch API integration
- DNA analysis
- Document OCR and face detection
- Photo analysis and identification
- Multi-user collaboration (beyond basic RBAC)
- Mobile app
- Real-time sync to cloud services
- Searching external genealogy databases

**Moved To:** Phase 2+ per product roadmap

---

## Dependencies and Risks

### Critical Dependencies
1. **Drizzle ORM + SQLite setup** — required by all person/family/event operations
2. **family-chart library integration** — required by all tree visualization stories
3. **GEDCOM parser** — required by import/export stories
4. **Full-text search (FTS5)** — required by search stories

### High-Risk Stories
1. **Story 3.3 (Import Conflict Detection)** — complex to implement merge logic; recommend deferring to Phase 1.5 or Phase 2
2. **Story 2.2 (Chart Type Switching)** — requires adapting family-chart and Topola; recommend MVP with pedigree only, switch types in Phase 1.5
3. **Story 2.5 (Print Chart)** — browser print APIs vary; recommend testing on target browsers first

### Sequencing Constraints
- Database setup (1.1) must come before any CRUD operations
- Person CRUD (1.1-1.3) must come before tree visualization
- GEDCOM import parser (3.1) must come before tree visualization to test with real data
- Search (4.1) can be implemented after person CRUD but before visualization for navigation

---

## Acceptance Testing Approach

### Must Have Stories
Each Must Have story has acceptance criteria that should be tested:
- **Unit tests:** GEDCOM parser, date validation, search queries
- **Integration tests:** Person CRUD API routes, family relationship queries
- **Component tests:** PersonDetail, FamilyChart, PersonSearch components
- **End-to-end tests:** Import GEDCOM → View tree → Search person → Open detail → Export (roundtrip)

### Should Have Stories
- Smoke tests and basic functionality verification
- Integration with Must Have features validated
- Performance tested with >500 persons in tree

### Manual Testing
- Import real GEDCOM files from Gramps, FamilySearch, Ancestry, Legacy
- Tree visualization with various tree sizes (5 persons, 50 persons, 500+ persons)
- Privacy mode exports on trees with living persons
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Accessibility review (WCAG 2.1 AA compliance for core features)

---

## Success Metrics for Phase 1

| Metric | Target | How to Measure |
|--------|--------|-----------------|
| **User Satisfaction (Phase 1 MVP)** | >80% | Post-launch survey of early users |
| **Feature Adoption** | >70% of active users use manual person entry | Analytics event tracking |
| **GEDCOM Roundtrip Fidelity** | 100% for Must Have fields, 95% for Should Have | Automated test suite: import → export → re-import comparison |
| **Tree Visualization Performance** | <2s render time for 500-person tree | Performance monitoring (React DevTools, Lighthouse) |
| **Search Response Time** | <100ms for autocomplete, <500ms for full search | API performance logging |
| **Data Ownership Confidence** | >90% of users feel their data is secure | User survey (after Phase 1) |
| **Defect Escape Rate** | <2 critical bugs post-launch | Issue tracker monitoring |
| **Onboarding Success** | >80% of new users reach tree visualization | Funnel analytics (empty state → first person → tree view) |

---

## Related Documentation
- [Phase 1: Core Manual Tree Builder](../phases/phase-1-core.md) — Implementation plan and weekly breakdown
- [Data Model](../architecture/data-model.md) — Database schema powering these stories
- [Product Vision](../vision.md) — High-level goals and success criteria
- [Tree Visualization Spec](../specs/tree-visualization.md) — Technical details on chart rendering
- [GEDCOM Import Spec](../specs/gedcom-import.md) — Technical details on parsing and validation
