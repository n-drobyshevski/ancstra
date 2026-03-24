import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './family-schema';

export function createTursoDb() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  return drizzle({ client, schema });
}

export type TursoDatabase = ReturnType<typeof createTursoDb>;

// ==================== Turso Platform API ====================

/**
 * Provision a new database via the Turso Platform API.
 * Requires TURSO_ORG and TURSO_PLATFORM_TOKEN env vars.
 */
export async function createTursoDatabase(name: string): Promise<{ url: string }> {
  const org = process.env.TURSO_ORG;
  const token = process.env.TURSO_PLATFORM_TOKEN;
  if (!org || !token) throw new Error('TURSO_ORG and TURSO_PLATFORM_TOKEN required for web mode');

  const res = await fetch(`https://api.turso.tech/v1/organizations/${org}/databases`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, group: 'default' }),
  });

  if (!res.ok) throw new Error(`Turso API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const hostname = data.database?.hostname || `${name}-${org}.turso.io`;
  return { url: `libsql://${hostname}` };
}

// ==================== Family Schema DDL ====================

/**
 * Complete DDL for all family database tables.
 * Extracted from family-schema.ts, research-schema.ts, ai-schema.ts, matching-schema.ts.
 * Includes every table and index used in per-family databases.
 */
const FAMILY_SCHEMA_DDL = `
-- ==================== PERSONS ====================
CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  sex TEXT NOT NULL DEFAULT 'U',
  is_living INTEGER NOT NULL DEFAULT 1,
  privacy_level TEXT NOT NULL DEFAULT 'private',
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_persons_sex ON persons(sex);

-- ==================== PERSON NAMES ====================
CREATE TABLE IF NOT EXISTS person_names (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  name_type TEXT NOT NULL DEFAULT 'birth',
  prefix TEXT,
  given_name TEXT NOT NULL,
  surname TEXT NOT NULL,
  suffix TEXT,
  nickname TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_person_names_person ON person_names(person_id);
CREATE INDEX IF NOT EXISTS idx_person_names_name ON person_names(surname, given_name);

-- ==================== FAMILIES ====================
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  partner1_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  partner2_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  relationship_type TEXT NOT NULL DEFAULT 'unknown',
  validation_status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

-- ==================== CHILDREN ====================
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  child_order INTEGER,
  relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
  relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
  validation_status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(family_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id, person_id);
CREATE INDEX IF NOT EXISTS idx_children_person ON children(person_id, family_id);

-- ==================== EVENTS ====================
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  date_original TEXT,
  date_sort INTEGER,
  date_modifier TEXT DEFAULT 'exact',
  date_end_sort INTEGER,
  place_text TEXT,
  description TEXT,
  person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_events_person ON events(person_id, date_sort);
CREATE INDEX IF NOT EXISTS idx_events_family ON events(family_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- ==================== SOURCES ====================
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  publication_date TEXT,
  repository_name TEXT,
  repository_url TEXT,
  source_type TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- ==================== SOURCE CITATIONS ====================
CREATE TABLE IF NOT EXISTS source_citations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  citation_detail TEXT,
  citation_text TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  person_name_id TEXT REFERENCES person_names(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_citations_source ON source_citations(source_id);
CREATE INDEX IF NOT EXISTS idx_citations_person ON source_citations(person_id);
CREATE INDEX IF NOT EXISTS idx_citations_event ON source_citations(event_id);
CREATE INDEX IF NOT EXISTS idx_citations_family ON source_citations(family_id);

-- ==================== TREE LAYOUTS ====================
CREATE TABLE IF NOT EXISTS tree_layouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  layout_data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ==================== FAMILY USER CACHE ====================
CREATE TABLE IF NOT EXISTS family_user_cache (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  updated_at TEXT NOT NULL
);

-- ==================== PENDING CONTRIBUTIONS ====================
CREATE TABLE IF NOT EXISTS pending_contributions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id TEXT,
  review_comment TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_contributions(status);

-- ==================== BIOGRAPHIES (AI-generated) ====================
CREATE TABLE IF NOT EXISTS biographies (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  tone TEXT NOT NULL,
  length TEXT NOT NULL,
  focus TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  created_at TEXT NOT NULL,
  UNIQUE(person_id, tone, length, focus)
);
CREATE INDEX IF NOT EXISTS idx_biographies_person ON biographies(person_id);

-- ==================== HISTORICAL CONTEXT (AI-generated) ====================
CREATE TABLE IF NOT EXISTS historical_context (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  events TEXT NOT NULL,
  model TEXT NOT NULL,
  cost_usd REAL,
  created_at TEXT NOT NULL,
  UNIQUE(person_id)
);

-- ==================== SEARCH PROVIDERS (research-schema) ====================
CREATE TABLE IF NOT EXISTS search_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  base_url TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT,
  rate_limit_rpm INTEGER NOT NULL DEFAULT 30,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  last_health_check TEXT,
  created_at TEXT NOT NULL
);

-- ==================== RESEARCH ITEMS (research-schema) ====================
CREATE TABLE IF NOT EXISTS research_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  snippet TEXT,
  full_text TEXT,
  notes TEXT,
  archived_html_path TEXT,
  screenshot_path TEXT,
  archived_at TEXT,
  provider_id TEXT REFERENCES search_providers(id),
  provider_record_id TEXT,
  discovery_method TEXT NOT NULL,
  search_query TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  promoted_source_id TEXT REFERENCES sources(id),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_items_status ON research_items(status);
CREATE INDEX IF NOT EXISTS idx_research_items_provider ON research_items(provider_id);
CREATE INDEX IF NOT EXISTS idx_research_items_created_by ON research_items(created_by);
CREATE INDEX IF NOT EXISTS idx_research_items_created_at ON research_items(created_at);

-- ==================== RESEARCH ITEM PERSONS (research-schema) ====================
CREATE TABLE IF NOT EXISTS research_item_persons (
  research_item_id TEXT NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  PRIMARY KEY (research_item_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_research_item_persons_person ON research_item_persons(person_id);

-- ==================== RESEARCH FACTS (research-schema) ====================
CREATE TABLE IF NOT EXISTS research_facts (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  fact_type TEXT NOT NULL,
  fact_value TEXT NOT NULL,
  fact_date_sort INTEGER,
  research_item_id TEXT REFERENCES research_items(id),
  source_citation_id TEXT REFERENCES source_citations(id),
  confidence TEXT NOT NULL DEFAULT 'medium',
  extraction_method TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_facts_person ON research_facts(person_id);
CREATE INDEX IF NOT EXISTS idx_research_facts_person_type ON research_facts(person_id, fact_type);

-- ==================== RESEARCH CANVAS POSITIONS (research-schema) ====================
CREATE TABLE IF NOT EXISTS research_canvas_positions (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,
  node_id TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  UNIQUE(person_id, node_type, node_id)
);
CREATE INDEX IF NOT EXISTS idx_canvas_positions_person ON research_canvas_positions(person_id);

-- ==================== SCRAPE JOBS (research-schema) ====================
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES research_items(id),
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  full_text TEXT,
  title TEXT,
  snippet TEXT,
  error TEXT,
  method TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_item ON scrape_jobs(item_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);

-- ==================== AI USAGE TRACKING (ai-schema) ====================
CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  task_type TEXT NOT NULL,
  session_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month ON ai_usage(user_id, created_at);

-- ==================== PROPOSED RELATIONSHIPS (ai-schema) ====================
CREATE TABLE IF NOT EXISTS proposed_relationships (
  id TEXT PRIMARY KEY,
  relationship_type TEXT NOT NULL,
  person1_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  person2_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_detail TEXT,
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  validated_by TEXT,
  validated_at TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_proposed_rels_status ON proposed_relationships(status);
CREATE INDEX IF NOT EXISTS idx_proposed_rels_person1 ON proposed_relationships(person1_id);
CREATE INDEX IF NOT EXISTS idx_proposed_rels_person2 ON proposed_relationships(person2_id);

-- ==================== MATCH CANDIDATES (matching-schema) ====================
CREATE TABLE IF NOT EXISTS match_candidates (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_data TEXT NOT NULL,
  match_score REAL NOT NULL,
  match_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(person_id, source_system, external_id)
);
CREATE INDEX IF NOT EXISTS idx_match_candidates_person ON match_candidates(person_id);
CREATE INDEX IF NOT EXISTS idx_match_candidates_status ON match_candidates(match_status);

-- ==================== RELATIONSHIP JUSTIFICATIONS (matching-schema) ====================
CREATE TABLE IF NOT EXISTS relationship_justifications (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  child_link_id TEXT REFERENCES children(id) ON DELETE CASCADE,
  justification_text TEXT NOT NULL,
  source_citation_id TEXT REFERENCES source_citations(id),
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_justifications_family ON relationship_justifications(family_id);
CREATE INDEX IF NOT EXISTS idx_justifications_child_link ON relationship_justifications(child_link_id);

-- ==================== ANCESTOR PATHS (closure table) ====================
CREATE TABLE IF NOT EXISTS ancestor_paths (
  ancestor_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  descendant_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);
CREATE INDEX IF NOT EXISTS idx_ap_descendant ON ancestor_paths(descendant_id, depth);
CREATE INDEX IF NOT EXISTS idx_ap_ancestor ON ancestor_paths(ancestor_id, depth);

-- ==================== PERSON SUMMARY (denormalized display) ====================
CREATE TABLE IF NOT EXISTS person_summary (
  person_id TEXT PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
  given_name TEXT NOT NULL DEFAULT '',
  surname TEXT NOT NULL DEFAULT '',
  sex TEXT NOT NULL,
  is_living INTEGER NOT NULL,
  birth_date TEXT,
  death_date TEXT,
  birth_date_sort INTEGER,
  death_date_sort INTEGER,
  birth_place TEXT,
  death_place TEXT,
  spouse_count INTEGER NOT NULL DEFAULT 0,
  child_count INTEGER NOT NULL DEFAULT 0,
  parent_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
`;

/**
 * Run the complete family schema DDL against a Turso database.
 * Used when provisioning a new family database in web mode.
 * All family DBs share TURSO_AUTH_TOKEN (org-level token).
 */
export async function runFamilySchemaDDL(dbUrl: string): Promise<void> {
  const httpsUrl = dbUrl.startsWith('libsql://') ? dbUrl.replace('libsql://', 'https://') : dbUrl;
  const client = createClient({ url: httpsUrl, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });
  await client.executeMultiple(FAMILY_SCHEMA_DDL);
}
