# Phase 6.5: Beta Period

> Weeks 37-38 (2 weeks) | Started: TBD | Target: TBD
> Prerequisite: Phase 6 gate passed (app deployed, tested, documented)

## Purpose

Structured beta testing with real genealogists before public launch. This is not a soft launch -- it's a focused feedback collection period where 3-5 real users exercise the app and report issues. The goal is to catch fundamental UX problems, workflow friction, and critical bugs that internal testing missed.

## Beta Recruitment

- [ ] Identify 3-5 beta testers:
  - At least 1 experienced genealogist (10+ years, has GEDCOM files, uses FamilySearch)
  - At least 1 casual family historian (newer to genealogy, smaller tree)
  - At least 1 non-technical family member (tests accessibility and onboarding)
  - Sources: r/Genealogy, genealogy forums, personal network
- [ ] Prepare beta onboarding:
  - [ ] Create beta tester guide (what to test, how to report issues)
  - [ ] Set up feedback collection (GitHub issues, Google Form, or similar)
  - [ ] Define 5-8 tasks for testers to complete (structured testing)

## Structured Test Tasks

Each beta tester should attempt these tasks and report their experience:

1. **Create account and import data** -- Sign up, import a GEDCOM file or manually add 10+ persons
2. **Navigate and explore tree** -- Find a specific ancestor, switch views, use search
3. **Edit and enrich** -- Edit a person, add events, add sources, add relationships
4. **Use AI research assistant** -- Ask a genealogy research question, review suggestions
5. **Upload and process a document** -- Upload a scan, run OCR, review extracted entities
6. **Invite a family member** -- Send an invitation, have them join and contribute
7. **Export data** -- Export tree as GEDCOM, verify it imports elsewhere
8. **Mobile experience** -- Complete tasks 1-3 on a phone

## Feedback Collection

- [ ] After each task, collect:
  - Task completion (success / partial / failed)
  - Time taken
  - Difficulty rating (1-5)
  - Friction points / confusion
  - Feature requests / suggestions
- [ ] After all tasks, collect:
  - Overall satisfaction (1-10)
  - Net Promoter Score ("Would you recommend?")
  - Top 3 things they liked
  - Top 3 things that need improvement
  - Comparison to tools they currently use

## Iteration

### Week 37: Testing & Collection

- [ ] Onboard beta testers
- [ ] Monitor error tracking (Sentry) for new issues
- [ ] Collect feedback as testers work through tasks
- [ ] Triage incoming bugs: Critical / High / Medium / Low
- [ ] Fix critical bugs immediately (same-day if possible)

### Week 38: Fixes & Final Iteration

- [ ] Fix all critical and high-priority bugs from beta feedback
- [ ] Address top 3 UX friction points
- [ ] Update documentation based on common questions
- [ ] Re-test fixed issues with beta testers
- [ ] Decide on any scope changes for launch

## MoSCoW Prioritization

| Priority | Items |
|----------|-------|
| **Must** | Recruit 3+ beta testers |
| **Must** | Fix all critical bugs from beta |
| **Must** | Complete structured test tasks |
| **Should** | Fix high-priority UX friction points |
| **Should** | Update documentation based on feedback |
| **Could** | Address feature requests |
| **Could** | Re-test with second round of testers |

## Exit Gate: Beta to Public Launch

- [ ] All critical bugs from beta fixed
- [ ] No blocking UX issues (all testers can complete core tasks)
- [ ] Beta tester satisfaction >= 7/10 average
- [ ] Error rate in Sentry is stable (not increasing)
- [ ] Documentation updated based on beta feedback
- [ ] Launch decision made: launch / extend beta / pivot

## Key Risks

1. **Insufficient beta testers** -- Can't find willing genealogists. Mitigate: start recruitment in Phase 4; offer early access as incentive; use personal network.
2. **Overwhelming feedback** -- Too many issues to fix in 2 weeks. Mitigate: strict MoSCoW triage; only fix critical/high; defer rest to post-launch.
3. **Beta testers not engaged** -- Testers sign up but don't actually use the app. Mitigate: structured tasks with deadlines; check in after 2 days; have backup testers.

## Decisions Made During This Phase

(Empty -- filled during implementation)

## Retrospective

(Empty -- filled at phase end)
