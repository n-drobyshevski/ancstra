# Accepted Security & Privacy Risks

> Risks evaluated and accepted with documented rationale. Review at each phase exit gate.
> Last reviewed: 2026-03-21

## AR-1: No Encryption at Rest for Local SQLite (DF-4)

**Risk:** The SQLite database file sits unencrypted on the user's disk. Anyone with file system access can read all genealogical data.

**Severity:** Medium

**Rationale for acceptance:**
- Local-only mode targets personal use on a private machine
- Disk encryption (BitLocker, FileVault, LUKS) is the appropriate layer for at-rest protection on personal devices
- Adding SQLCipher introduces a dependency and key management complexity disproportionate to the threat

**Upgrade path:** SQLCipher can be added as an optional dependency if users request it. The Drizzle ORM layer is agnostic to the underlying SQLite driver.

**Review trigger:** Reconsider if Ancstra is deployed in a multi-user environment or on shared machines.

---

## AR-2: Local Mode Runs on HTTP (IS-7)

**Risk:** `next dev` and `next start` on localhost use HTTP. If someone accesses the app from another device on the same network, credentials and data travel in plaintext.

**Severity:** Low

**Rationale for acceptance:**
- Local mode is designed for single-user access on localhost
- Adding HTTPS to localhost requires certificate management (mkcert or self-signed)
- The attack requires physical network proximity AND knowing the app is running

**Mitigation:** Bind to `127.0.0.1` (not `0.0.0.0`) by default in `next.config.ts` to prevent LAN access.

**Review trigger:** Reconsider if a "LAN sharing" feature is requested.

---

## AR-3: Indirect Identification Through Tree Relationships (PE-3)

**Risk:** Even with the living-person filter replacing names with "Living," the tree structure reveals identity. "Living is the child of Hans Schmidt (1955-2020) and Maria Schmidt (1960-)" is identifiable.

**Severity:** High (but inherent to genealogy apps)

**Rationale for acceptance:**
- This is a fundamental property of family trees — suppressing structure eliminates the app's value
- Every genealogy application (Ancestry, FamilySearch, Gramps) has this same limitation
- The living-person filter (PE-1) reduces the attack surface by stripping dates, places, events, and media

**Mitigation:**
- Viewer role sees relationship counts only, not identities (e.g., "2 children" not "child: Living")
- Owner/admin roles see full data (acceptable for personal use)
- Web mode should default to viewer-level redaction for unauthenticated users

**Review trigger:** Reconsider if a "public tree" sharing feature is added.
