# Security Checklist

Run before each release. Check each item manually.

## Authentication & Authorization

- [ ] Unauthenticated requests to /api/* return 401
- [ ] Viewer role cannot access DELETE endpoints (returns 403)
- [ ] Editor role cannot access /api/settings/* (returns 403)
- [ ] Living person data is redacted for viewer role
- [ ] Expired JWT tokens redirect to /login
- [ ] OAuth login creates/links account correctly

## Input Validation

- [ ] SQL injection in person name field: `'; DROP TABLE persons; --` → stored as literal string
- [ ] XSS in notes field: `<script>alert('xss')</script>` → rendered escaped
- [ ] Very long inputs (10,000 chars) → handled gracefully (no crash)

## Tokens & Sessions

- [ ] NextAuth cookies have SameSite=Lax and HttpOnly
- [ ] Invite tokens expire after 7 days
- [ ] Revoked invite tokens cannot be used
- [ ] Already-accepted invite tokens cannot be reused

## Rate Limiting

- [ ] /join endpoint rejects after 10 rapid requests from same IP

## Infrastructure

- [ ] No sensitive data in client JavaScript bundle (check Network tab)
- [ ] No API keys, secrets, or password hashes in responses
- [ ] CORS on worker allows only production domain
- [ ] Environment variables not exposed to client (no NEXT_PUBLIC_ prefix on secrets)

## Data Privacy

- [ ] Living persons (born <100 years, no death) show "Living" for viewers
- [ ] GEDCOM export with "exclude living" actually removes them
- [ ] Activity feed entries are redacted for viewers when they reference living persons
