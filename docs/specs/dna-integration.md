# DNA Data System

> Phase: 4 | Status: Not Started
> Depth: design-level
> Dependencies: [data-model.md](../architecture/data-model.md), [relationship-validation.md](../architecture/relationship-validation.md)
> Data model: dna_kits, dna_snps (encrypted SQLite via SQLCipher)

## Overview

Manages DNA test results from major providers (23andMe, AncestryDNA, MyHeritage, FTDNA). Stores raw SNP data in encrypted separate database, supports cM-based relationship estimation, and provides chromosome browser visualization. Phase 4; IBD segment detection and population genetics deferred.

## Requirements

- [ ] File format parsers for all major providers (23andMe, Ancestry, MyHeritage, FTDNA)
- [ ] Encrypted storage (separate SQLCipher database, never co-mingled with genealogy)
- [ ] DNA kit lifecycle (import, link to person, manage multiple kits)
- [ ] SNP indexing by chromosome and position
- [ ] cM-based relationship estimation (DNA Painter reference data)
- [ ] Chromosome browser visualization (D3.js)
- [ ] Link DNA profiles to tree persons
- [ ] Deferred: IBD segment detection, population genetics analysis, cousin matching

## Design

### Scope & Deferred

**Implemented (Phase 4):**
- Raw DNA file import (all major providers)
- Encrypted storage
- cM relationship estimation
- Chromosome browser visualization
- Person linking

**Deferred (Phase 5+):**
- IBD (Identical By Descent) segment detection (requires PLINK)
- Population genetics analysis (requires scikit-allel, Python)
- Cousin matching engine
- Genetic ethnicity estimation

### File Parsers

Simple format parsers for SNP data from all providers (CSV/TSV):

```typescript
// 23andMe: rsid \t chromosome \t position \t genotype
// Comments start with #
interface DnaSnp {
  rsid: string          // SNP ID (rs12345)
  chromosome: string    // '1'-'22' or 'X', 'Y', 'MT'
  position: number      // genomic position (bp)
  genotype: string      // e.g., 'AA', 'AT', 'TT', '--' (missing)
}

function parse23andMe(content: string): DnaSnp[]

function parseAncestryDNA(content: string): DnaSnp[]

function parseMyHeritage(content: string): DnaSnp[]

function parseFTDNA(content: string): DnaSnp[]

// Returns standardized DnaSnp[] for all formats
```

**Provider formats:**

- **23andMe:** TSV with header, comments, SNPs separated by chromosome
- **AncestryDNA:** CSV with rsid, chromosome, position, allele1, allele2
- **MyHeritage:** CSV similar to Ancestry
- **FTDNA (Family Tree DNA):** Text format, YSNP and autosomal data

All parsers normalize to common schema (rsid, chromosome, position, genotype).

### Encrypted Storage

DNA data stored in **separate encrypted SQLite database** using SQLCipher. Never co-mingled with main genealogy database.

```typescript
function createDnaDatabase(path: string, key: string): Database

// Initialization creates schema:
// - dna_kits(id, person_id, provider, snp_count, import_date)
// - dna_snps(kit_id, rsid, chromosome, position, genotype)
// - idx_snps_chr index for fast lookups
```

**Security:**

- Separate database file (e.g., `dna.db`)
- Encryption key: SHA-256 hash of user password or separate master key
- Never decrypt unless user explicitly requests analysis
- No export of raw DNA data (only aggregated results)

**Schema:**

```typescript
table dna_kits {
  id: string PRIMARY KEY
  person_id: string REFERENCES persons(id)
  provider: string              // '23andme', 'ancestry', 'myheritage', 'ftdna'
  snp_count: number
  import_date: string ISO date
  matched_kit_ids: string[]     // Other kits to compare against (privacy gated)
}

table dna_snps {
  kit_id: string REFERENCES dna_kits(id)
  rsid: string
  chromosome: string
  position: number
  genotype: string
  PRIMARY KEY (kit_id, rsid)
}

index idx_snps_chr ON (kit_id, chromosome, position)
```

### cM-Based Relationship Estimation

Maps shared centimorgans (cM) to relationship types using DNA Painter's empirical data:

```typescript
const CM_RANGES = [
  { min: 3400, max: 3700, rels: ['Parent/Child', 'Full Sibling'] },
  { min: 1700, max: 3400, rels: ['Grandparent', 'Aunt/Uncle', 'Half Sibling'] },
  { min: 800, max: 1700, rels: ['1st Cousin', 'Great-Grandparent', 'Great-Aunt/Uncle'] },
  { min: 200, max: 800, rels: ['2nd Cousin', '1st Cousin Once Removed'] },
  { min: 20, max: 200, rels: ['3rd-4th Cousin'] },
  { min: 6, max: 20, rels: ['5th-6th Cousin'] },
];

function estimateRelationship(sharedCm: number): string[]
// Returns array of possible relationships (e.g., ['1st Cousin', 'Great-Grandparent'])
```

**Usage:**

1. User uploads two DNA kits
2. Compute shared cM between kits (aggregate overlapping genotypes)
3. Look up possible relationships
4. Display to user with caveat: "Based on shared DNA, this person could be..."
5. Suggest manual confirmation via tree structure

**Caveats:**
- Overlap ranges are broad; many relationships map to same cM range
- Required for manual genealogical confirmation
- Unusually low/high cM may indicate non-paternity or population outlier

### Chromosome Browser

D3.js-based visualization of shared DNA segments:

```typescript
interface ChromosomeBrowser {
  kit1Id: string
  kit2Id: string
  sharedSegments: {
    chromosome: string
    startPosition: number
    endPosition: number
    sharedCm: number
    snpCount: number
  }[]
}
```

**Visual design:**

- Horizontal bars for chromosomes 1-22 + X
- Each segment colored by shared cM (gradient from light to dark)
- Hover shows: chromosome, position range, cM, SNP count
- Click to zoom into chromosome detail
- Compare multiple kits side-by-side

## Edge Cases & Error Handling

- **Missing genotypes (-- in 23andMe):** Skip in analysis, don't count toward shared cM
- **Mismatched chromosomes:** Warn user about heterozygous sites
- **Very low match (< 6 cM):** Mark as "potentially distant" with low confidence
- **No shared segments:** Output "not DNA related" or "distant relative"
- **Invalid kit file:** Validate format, report line number of errors
- **Privacy-aware:** Never auto-display matches; require user opt-in

## Open Questions

- DNA matching with FamilySearch DNA feature (requires API)?
- Cousin suggestion engine (require IBD detection)?
- Ethnicity estimate display (need population reference databases)?
- Microarray vs whole-genome: different SNP sets, how to handle?
- Integration with public DNA databases (1000 Genomes)?
- Haplotype analysis and migration inference?

## Implementation Notes

Location: `packages/dna/`

Key files:
- `parsers/parse-*.ts` - Provider-specific file format parsers
- `storage/dna-database.ts` - SQLCipher wrapper
- `analysis/relationship-estimator.ts` - cM lookup and estimation
- `visualization/chromosome-browser.ts` - D3.js visualization
- `linking/dna-person-linker.ts` - Manual kit-to-person linking

**Dependencies:**

- `better-sqlite3` - SQLite with SQLCipher support
- `d3` - Chromosome browser visualization
- Separate encryption key management (use Next.js environment + secure session storage)
