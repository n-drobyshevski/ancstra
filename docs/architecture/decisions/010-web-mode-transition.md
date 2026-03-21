# ADR-010: Local-to-Web Mode Transition Security Design

**Status:** Accepted
**Date:** 2026-03-21
**Context:** The security assessment (DF-1) identified that migrating from local SQLite to Turso uploads the entire database to the cloud with no sanitization step. Users may have sensitive notes (adoption, paternity, mental health) they would not share online. The transition also changes the GDPR status from exempt to regulated.

**Decision:** Implement a pre-migration review screen that:

1. **Scans the database** for sensitive content before upload:
   - Count of living persons (will be shared in the cloud)
   - Persons with non-empty `notes` fields (may contain sensitive text)
   - Events with special category data (baptism, confirmation — religious)
   - Media files (photos of living persons)
   - `privacy_level = 'restricted'` records

2. **Presents a summary** showing what will be uploaded:
   - "X living persons will be stored in Turso (EU region)"
   - "Y persons have notes that will be uploaded"
   - "Z media files will be referenced"
   - Link to ROPA and privacy policy

3. **Offers selective redaction** before migration:
   - Option to clear all notes before upload
   - Option to exclude living persons (deceased-only tree in web mode)
   - Option to exclude media references
   - Confirmation checkbox: "I understand this data will be processed under GDPR"

4. **Runs the Web Mode Readiness Gate** checklist automatically:
   - Verify all Tier 1 blockers from Appendix A are resolved
   - Block migration if any blocker is unresolved

**Implementation phase:** Before web mode is first enabled (Phase 4 or Phase 6, depending on when web deployment is targeted).

**Data flow:**
```
User clicks "Enable Web Mode"
  -> Pre-migration scan runs
  -> Summary screen displayed
  -> User reviews and optionally redacts
  -> Readiness Gate checklist verified
  -> Database uploaded to Turso (EU region)
  -> Cookie config switches to Secure/HttpOnly/SameSite=Strict
  -> App restarts with Turso connection
```

**Consequences:**
- Users cannot accidentally upload sensitive data to the cloud
- The GDPR transition is explicit and informed
- Readiness Gate enforcement prevents premature web deployment
- The migration is a one-time operation (not reversible without manual intervention)
