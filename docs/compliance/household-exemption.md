# GDPR Household Exemption — Applicability to Ancstra

> GDPR Article 2(2)(c): "This Regulation does not apply to the processing of personal data by a natural person in the course of a purely personal or household activity."

## Analysis

### Local Mode: Likely Exempt

Ancstra in local-only mode (SQLite on the user's machine, accessed only via localhost) qualifies for the household exemption because:

1. **Single user** — only the tree owner accesses the data
2. **Personal purpose** — genealogy research for personal/family interest
3. **No publication** — data does not leave the user's machine (except via explicit export)
4. **No commercial activity** — personal use, not a service offered to others

**Precedent:** The CJEU in *Lindqvist* (C-101/01) held that publishing personal data on an internet page is NOT a household activity. Conversely, storing data locally for personal reference IS household activity.

**Edge cases that do NOT break the exemption:**
- Exporting a GEDCOM file and emailing it to a family member (one-time personal sharing)
- Viewing the tree on another device on the same local network

**Edge cases that MAY break the exemption:**
- Sharing a GEDCOM containing living persons' data on a public genealogy forum
- Running the local app as a service for others to access

### Web Mode: NOT Exempt

Deploying Ancstra to Vercel with Turso breaks the household exemption because:

1. **Cloud hosting** — data is processed by third-party infrastructure (Turso, Vercel)
2. **URL-accessible** — anyone with the link can access the tree (even if restricted to family)
3. **Third-party processors** — data is transmitted to processors (Anthropic, Sentry, etc.)
4. **Multiple users** — family members accessing the shared tree are data subjects

**Consequence:** Full GDPR obligations apply from the moment web mode is enabled. See the Web Mode Readiness Gate in the security assessment spec.

### The Transition Is the Legal Inflection Point

The local-to-web transition is not just a database driver swap. It is the moment when:
- The tree owner becomes a **data controller** under GDPR
- Living persons in the tree become **data subjects** with rights (access, erasure, rectification)
- Third-party services become **data processors** requiring DPAs
- A **privacy policy** must be published
- **Consent** may be required for processing living persons' data

This is why the security assessment requires a Web Mode Readiness Gate (Appendix A of the assessment spec).

## Recommendation

1. Document this analysis (this file) and reference it in the Phase 1 compliance checklist
2. Do NOT enable web mode until the Readiness Gate is cleared
3. Consider adding a startup warning in web mode: "You are processing personal data under GDPR. Ensure you have completed the Web Mode Readiness Gate."

## References

- GDPR Article 2(2)(c)
- CJEU Case C-101/01 (*Lindqvist*), 2003
- Article 29 Working Party Opinion 5/2009 on online social networking
- Security Assessment Spec: `docs/superpowers/specs/2026-03-21-security-privacy-legal-assessment-design.md`
