# UX Roadmap — Phases 2-5

High-level UX considerations for future phases. Not wireframes — notes on design challenges, patterns to research, and components that need early thinking.

---

## Phase 2: AI Search & Matching (Weeks 9-18)

### UX Challenges

**FamilySearch OAuth Flow**
- Users must connect their FamilySearch account — explain why clearly
- "Connect to FamilySearch" CTA with benefits: "Search 66B+ free records"
- Handle OAuth redirect gracefully (return to same context)
- Show connection status in settings

**Match Candidate Review Queue**
- List of potential record matches sorted by confidence score
- Each match card: person name, source info, confidence %, key matching fields
- Actions: Accept (attach to person), Reject (dismiss), Maybe (save for later)
- Batch operations for power users (Margaret persona)

**AI Research Assistant Chat UI**
- Embedded chat panel (right side or bottom drawer)
- Context-aware: knows which person/branch user is viewing
- Tool-call results displayed inline (record snippets, suggested relationships)
- Streaming responses with typing indicator
- Conversation history per research session

**Confidence Score Visualization**
- Don't show raw numbers (0.85 means nothing to users)
- Use labels: "Strong Match" (>0.8), "Possible Match" (0.5-0.8), "Weak Match" (<0.5)
- Color-coded: green, amber, red
- Show which fields matched/mismatched in expandable detail

**Proposed Relationship Indicators**
- Dashed lines on tree (designed in Phase 1 design system)
- Notification badge on tree: "3 new suggestions"
- Validation queue accessible from sidebar

### Patterns to Research
- Chat interfaces (Cursor, GitHub Copilot chat patterns)
- Review/triage queues (GitHub PR review, email triage)
- Confidence/score visualization (credit scores, weather probability)

### Components to Plan Early
- `ChatPanel` — conversational AI UI with tool results
- `MatchCard` — record match with accept/reject actions
- `ConfidenceBadge` — labeled score indicator
- `SourcePreviewCard` — external record preview before attachment

---

## Phase 3: Document Processing (Weeks 19-25)

### UX Challenges

**Document Upload & Gallery**
- Drag-and-drop upload for photos and documents
- Gallery grid view with thumbnails
- Attach documents to specific persons or events
- Metadata display (date taken, file size, dimensions)

**OCR Result Display**
- Side-by-side view: original document image (left) + extracted text (right)
- Synchronized scrolling between image and text
- Zoom on document image (pinch, scroll wheel)
- Text is editable (correct OCR errors)

**AI Entity Extraction Review**
- Highlight detected names, dates, places in OCR text with colored chips
- Click a highlighted entity to link it to a tree person or create new
- Show confidence per entity
- "Accept all" batch action for high-confidence extractions

**Citation Auto-Generation**
- Preview generated citation (Chicago/APA format) before saving
- Editable fields: author, title, repository, access date
- Auto-populate from document metadata where possible

### Patterns to Research
- Document viewers (Google Docs, PDF.js, museum archive viewers)
- Text annotation interfaces (Hypothesis, NER annotation tools)
- Side-by-side comparison layouts

### Components to Plan Early
- `DocumentViewer` — zoomable image viewer with pan
- `TextHighlighter` — overlays for entity extraction
- `EntityChip` — clickable detected entity (name/date/place)
- `CitationEditor` — formatted citation with editable fields
- `GalleryGrid` — thumbnail grid with selection

---

## Phase 4: Photos & DNA (Weeks 26-33)

### UX Challenges

**Face Detection & Tagging**
- Show bounding boxes on photos over detected faces
- Click a face box to assign a person (search/select)
- Untagged faces highlighted differently from tagged
- Face clustering: group similar unidentified faces together

**Face Clustering Gallery**
- Grid of face clusters: "These 12 faces might be the same person"
- Assign a person identity to a cluster (bulk tag)
- Split/merge clusters when algorithm is wrong
- Before/after comparison for similar faces

**Chromosome Browser**
- Complex D3 visualization showing shared DNA segments
- 23 chromosome pairs with colored segments
- Hover for segment details (start/end position, cM, matching person)
- This is the most complex visualization in the entire app

**DNA Consent & Privacy**
- DNA data is deeply personal — consent flow before upload
- Clear explanation of what the app does with DNA data
- "Your DNA data never leaves your device" messaging (local-first)
- Option to delete DNA data completely

**Relationship Estimation**
- Show probability ranges: "1st cousin (probability: 45%) or half-sibling (30%)"
- Visual relationship diagram showing possible positions
- Explain cM values in plain language

### Patterns to Research
- Photo tagging (Google Photos, Apple Photos face recognition UX)
- Chromosome browsers (GEDmatch, DNA Painter)
- Data privacy consent flows (GDPR cookie banners, health data apps)
- Probability visualization (weather apps, medical risk displays)

### Components to Plan Early
- `FaceTagOverlay` — bounding box overlay on photos with assign action
- `FaceClusterGrid` — grouped similar faces with merge/split
- `ChromosomeBrowser` — D3 chart of shared DNA segments
- `DNAMatchCard` — match with relationship estimate and cM
- `ConsentDialog` — multi-step consent with clear data usage explanation
- `ProbabilityChart` — visual relationship probability display

---

## Phase 5: Collaboration & Polish (Weeks 34-41)

### UX Challenges

**Multi-User Invitation**
- Invite by email with role selection (admin, editor, viewer)
- Invitation email with accept link
- Pending invitations list with resend/revoke
- Different onboarding for invited members vs tree owner

**Role-Based UI**
- Viewers: read-only, no edit buttons visible
- Editors: full CRUD, but can't manage users or delete tree
- Admins: manage users, configure settings
- Owner: full control including delete tree
- Subtle visual cues showing current permissions

**Activity Feed**
- Timeline of changes: who changed what, when
- Filterable: by person, by user, by action type
- Click to view the change (diff or before/after)
- Notifications for changes to "followed" persons

**Conflict Resolution**
- Two editors changing the same person simultaneously
- Show conflict dialog: "Alex also edited [field]. Keep yours / Keep theirs / Merge"
- Highlight conflicting fields
- Activity log shows resolution

**Data Quality Dashboard**
- Tree-wide statistics: total persons, % with sources, % with dates, % with places
- "Improve your tree" suggestions (persons missing dates, unsourced events)
- Progress tracking over time (was 60% sourced, now 72%)

**AI Biography Generation**
- Generate narrative from person's data (events, relationships, sources)
- Preview and edit before saving
- Tone options: formal, conversational, child-friendly
- Include source references inline

### Patterns to Research
- Collaborative editing (Google Docs, Notion, Figma multiplayer)
- Invitation flows (Slack, Notion team invites)
- Activity feeds (GitHub, Jira activity streams)
- Data quality dashboards (CRM data health, SEO audit tools)

### Components to Plan Early
- `InviteForm` — email input with role selector
- `RoleBadge` — visual indicator of user's role
- `ActivityFeedItem` — who-what-when with diff link
- `ConflictDialog` — side-by-side change comparison
- `DataQualityCard` — metric with trend indicator
- `BiographyPreview` — generated text with edit capability

---

## Cross-Phase Design Principles

Establish these now and apply consistently across all phases:

### 1. Progressive Disclosure
Start simple, reveal complexity on demand. Person form shows name/sex/dates by default; expand for events, sources, notes. Search shows basic results; expand for advanced filters. Don't overwhelm Jordan or Alex with Margaret's power features.

### 2. Context-Preserving Navigation
Never lose your place in the tree. Person detail opens as a side panel, not a new page. "Add relative" is contextual from the current person. Back button returns to exact tree position and zoom level.

### 3. Undo-Friendly
All destructive actions have confirmation dialogs. Soft-delete with undo window (toast: "Person deleted. Undo?"). Import can be rolled back. No permanent damage without explicit confirmation.

### 4. Source-First Culture
Gently encourage source attachment without blocking. After adding an event: "Add a source for this event?" (dismissible). Completion indicator penalizes unsourced data. Never require sources — Margaret will add them, Alex won't yet.

### 5. Privacy-Visible
Always show when living-person filters are active. Export UI clearly explains what each privacy mode hides. Living persons show "Living" badge. Search results can be filtered to living/deceased. Never accidentally expose living person data.

### 6. Mobile-Viable
Every feature must be usable on mobile, even if not optimal. Tree view: full-screen canvas with touch gestures. Forms: single-column, collapsible sections. Person detail: full-screen page (not side panel). Search: full-screen with filter bottom sheet.
