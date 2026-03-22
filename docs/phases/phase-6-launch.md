# Phase 6: Deployment & Launch

> Weeks 34-36 (3 weeks) | Started: TBD | Target: TBD

## Goals

- Deploy the full application to Vercel + Turso for web access
- Complete comprehensive testing (unit, integration, E2E, performance, security, accessibility)
- Write user documentation, privacy policy, and terms of service
- Final bug fixes, polish, and launch preparation

## Systems in Scope

- [Architecture Overview](../architecture/overview.md) (deployment, testing, CI/CD)

## Task Breakdown

### Week 34: Deployment & Infrastructure

**Goal:** Ship to production.

- [ ] Configure Vercel deployment:
  - [ ] Connect GitHub repository to Vercel
  - [ ] Set up environment variables (API keys, OAuth, database URL)
  - [ ] Configure custom domain + HTTPS
  - [ ] Test deployment pipeline: push to main triggers deploy
- [ ] Set up Turso production database:
  - [ ] Create Turso database instance
  - [ ] Run migrations against Turso
  - [ ] Verify all queries work (validated in Phase 0.5 spike)
  - [ ] Test data migration path: local SQLite to Turso
- [ ] Implement backup strategy:
  - [ ] Automated Turso database snapshots
  - [ ] GEDCOM export as secondary backup mechanism
  - [ ] Document backup/restore procedure
- [ ] Set up monitoring:
  - [ ] Sentry for error tracking (free tier)
  - [ ] Web Vitals reporting
  - [ ] API response time logging
  - [ ] Database query performance logging
- [ ] Configure CI/CD pipeline (GitHub Actions):
  - [ ] Lint (ESLint)
  - [ ] Type check (`pnpm typecheck`)
  - [ ] Unit + integration tests (`pnpm test`)
  - [ ] E2E tests (`pnpm test:e2e`)
  - [ ] Build (`pnpm build`)
  - [ ] Auto-deploy to Vercel on merge to main

### Week 35: Comprehensive Testing

**Goal:** Verify everything works end-to-end.

- [ ] End-to-end tests with Playwright:
  - [ ] Import GEDCOM -> view tree -> edit person -> export GEDCOM
  - [ ] Upload media -> run OCR -> extract entities -> link to person
  - [ ] Create multi-user family -> invite member -> contribute
  - [ ] AI research assistant: ask question -> get tool-assisted answer
  - [ ] (Post-launch) DNA upload -> match -> validate relationship
- [ ] Performance testing:
  - [ ] Load test: simulate 10+ concurrent users
  - [ ] Database stress: test with 1000+ persons
  - [ ] API response times under load
  - [ ] Verify benchmarks from Phase 1 still pass
- [ ] Security testing:
  - [ ] Authentication/authorization boundary testing
  - [ ] Living person privacy filter validation
  - [ ] Basic penetration testing: invalid inputs, SQL injection, XSS
  - [ ] Rate limiting verification
- [ ] Accessibility testing:
  - [ ] Screen reader compatibility (NVDA/VoiceOver)
  - [ ] Keyboard navigation through all major flows
  - [ ] Color contrast (WCAG AA)
  - [ ] Test accessible tree view alternative (list/outline)

### Week 36: Documentation, Polish & Launch Prep

**Goal:** Final polish and launch.

- [ ] Write user documentation:
  - [ ] Getting started guide
  - [ ] Feature walkthroughs (tree, GEDCOM, research, documents, collaboration)
  - [ ] FAQ
- [ ] Write legal documents:
  - [ ] Privacy policy (media data handling, living person privacy)
  - [ ] Terms of service
  - [ ] Cookie consent (if applicable)
- [ ] Final polish:
  - [ ] Fix all critical and high-priority bugs
  - [ ] Improve error messages (helpful, not technical)
  - [ ] Loading states (spinners, skeleton screens) everywhere
  - [ ] Confirmation dialogs for destructive actions
  - [ ] Test on mobile devices
  - [ ] Dark mode verification
- [ ] Launch preparation:
  - [ ] Create welcome flow for new users
  - [ ] Write announcement / blog post (optional)
  - [ ] Set up feedback collection mechanism
  - [ ] Verify offline PWA functionality
- [ ] Final checklist:
  - [ ] All critical bugs fixed
  - [ ] Performance acceptable (page load <3s)
  - [ ] Mobile responsive
  - [ ] Offline PWA working
  - [ ] Backup/export working
  - [ ] Living person privacy confirmed
  - [ ] Multi-user authentication tested
  - [ ] No console errors in production build
  - [ ] Error tracking active (Sentry)

## MoSCoW Prioritization

| Priority | Items |
|----------|-------|
| **Must** | Vercel + Turso deployment |
| **Must** | E2E tests for critical paths |
| **Must** | Security testing (auth, privacy) |
| **Must** | Privacy policy |
| **Must** | Critical bug fixes |
| **Should** | Performance testing (load, stress) |
| **Should** | Accessibility testing |
| **Should** | User documentation |
| **Should** | Welcome flow |
| **Could** | Blog post / announcement |
| **Could** | Demo video |

## Documentation (write during this phase)

- [ ] Deployment guide (Vercel + Turso setup)
- [ ] User guide (getting started, feature walkthroughs)
- [ ] Privacy policy, Terms of service
- [ ] Developer docs (API, schema, contributing)

## Exit Gate: Phase 6 to Phase 6.5 (Beta)

- [ ] App deployed and accessible at production URL
- [ ] All critical-path E2E tests pass
- [ ] Performance benchmarks met (<500ms API, <3s page load)
- [ ] Security checklist completed (no critical vulnerabilities)
- [ ] Privacy policy published
- [ ] Error tracking active and receiving events
- [ ] At least 1 successful backup/restore test

## Key Risks

1. **Turso migration issues** -- Edge cases in Drizzle driver swap. Mitigate: validated in Phase 0.5 spike; test thoroughly with production data volume.
2. **Performance at scale** -- 1000+ persons + concurrent users may slow app. Mitigate: caching, query optimization, CDN, monitoring in place.

## Decisions Made During This Phase

(Empty -- filled during implementation)

## Retrospective

(Empty -- filled at phase end)
