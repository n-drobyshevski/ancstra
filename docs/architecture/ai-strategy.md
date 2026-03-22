# AI Strategy

This document details the architecture for integrating Claude AI into Ancstra as an intelligent genealogy research co-pilot.

## Architecture Overview

The AI research assistant uses the Vercel AI SDK with Claude's tool-calling capability to create an intelligent genealogy co-pilot that knows the user's tree and can query external sources.

```
┌─────────────────────────────────────────────┐
│              AI Chat Interface               │
│  ┌────────────────────────────────────────┐  │
│  │  User: "Find records for my           │  │
│  │         great-grandmother Maria"       │  │
│  └──────────────────┬─────────────────────┘  │
│                     │                        │
│  ┌──────────────────┴─────────────────────┐  │
│  │         Vercel AI SDK (streaming)      │  │
│  │                                        │  │
│  │  System prompt:                        │  │
│  │  - Tree context (summarized pedigree)  │  │
│  │  - Research methodology                │  │
│  │  - Available tools                     │  │
│  │                                        │  │
│  │  Tools:                                │  │
│  │  ├── searchLocalTree                   │  │
│  │  ├── searchFamilySearch                │  │
│  │  ├── searchNARA                        │  │
│  │  ├── searchNewspapers                  │  │
│  │  ├── computeRelationship              │  │
│  │  ├── analyzeTreeGaps                   │  │
│  │  ├── explainRecord                     │  │
│  │  ├── proposeRelationship               │  │
│  │  └── suggestNextSteps                  │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## System Prompt Design

The system prompt frames Claude as a genealogy research expert with access to the user's tree and external records.

```typescript
// packages/ai/prompts/research-assistant.ts

export function buildSystemPrompt(treeContext: TreeContext): string {
  return `You are a genealogy research assistant with deep knowledge of historical records, research methodology, and the user's family tree.

## Your Family Tree Context
${treeContext.summary}

## Key People
${treeContext.keyPersons.map(p =>
  `- ${p.name} (${p.birthYear || '?'}–${p.deathYear || '?'}), ${p.birthPlace || 'unknown birthplace'}`
).join('\n')}

## Research Gaps
${treeContext.gaps.map(g => `- ${g}`).join('\n')}

## Guidelines
1. **Documents are the source of truth.** Always cite specific records. Never fabricate genealogical data.
2. **Be specific about uncertainty.** Say "this census record suggests..." not "your ancestor was..."
3. **Explain your reasoning.** When making connections, show the evidence chain.
4. **Suggest next steps.** After answering, recommend what records to search next.
5. **Consider historical context.** Name spelling variations, border changes, calendar differences.
6. **Privacy-aware.** Never share details about living persons.

## Available Tools
You have access to tools for searching the local tree database, FamilySearch records, NARA catalog, and Chronicling America newspapers. Use them proactively to answer questions with real data.

## Record Types You Can Search
- Census records (US: 1790-1950, UK: 1841-1921)
- Vital records (birth, marriage, death certificates)
- Immigration records (ship manifests, naturalization papers)
- Military records (draft cards, service records, pension files)
- Church records (baptism, marriage, burial)
- Newspaper articles (obituaries, announcements)
- Land and property records
- Probate records (wills, estate inventories)`;
}
```

## Tool Definitions

Tools expose the assistant with actionable capabilities for genealogy research. Each tool has clear inputs, outputs, and execution logic.

```typescript
// packages/ai/tools/genealogy-tools.ts

import { tool } from 'ai';
import { z } from 'zod';

export const searchLocalTree = tool({
  description: 'Search the local family tree database for persons matching a query',
  parameters: z.object({
    givenName: z.string().optional().describe('Given/first name to search'),
    surname: z.string().optional().describe('Family/last name to search'),
    birthYear: z.number().optional().describe('Approximate birth year'),
    birthPlace: z.string().optional().describe('Birth place to search'),
    query: z.string().optional().describe('Free-text search across all fields'),
  }),
  execute: async ({ givenName, surname, birthYear, birthPlace, query }) => {
    // Search FTS index and exact matches
    // Return matching persons with their events and relationships
  },
});

export const searchFamilySearch = tool({
  description: 'Search FamilySearch.org records for historical records matching a person',
  parameters: z.object({
    givenName: z.string().describe('Given name'),
    surname: z.string().describe('Surname'),
    birthDate: z.string().optional().describe('Birth date (year or full date)'),
    birthPlace: z.string().optional().describe('Birth place'),
    deathDate: z.string().optional().describe('Death date'),
    deathPlace: z.string().optional().describe('Death place'),
    recordType: z.enum(['census', 'vital', 'military', 'immigration', 'church', 'any'])
      .default('any').describe('Type of record to search for'),
  }),
  execute: async (params) => {
    // Call FamilySearch API via our client
    // Return top 5 results with summaries
  },
});

export const searchNARA = tool({
  description: 'Search the US National Archives catalog for government records',
  parameters: z.object({
    query: z.string().describe('Search query'),
    resultType: z.enum(['all', 'item', 'fileUnit', 'series']).default('all'),
  }),
  execute: async ({ query, resultType }) => {
    // Call NARA Catalog API
  },
});

export const searchNewspapers = tool({
  description: 'Search Chronicling America for historical newspaper articles (1756-1963)',
  parameters: z.object({
    query: z.string().describe('Search terms (names, places, events)'),
    dateRange: z.object({
      start: z.string().optional().describe('Start date YYYY'),
      end: z.string().optional().describe('End date YYYY'),
    }).optional(),
    state: z.string().optional().describe('US state to filter by'),
  }),
  execute: async ({ query, dateRange, state }) => {
    // Call Chronicling America API (no key required)
    const params = new URLSearchParams({ terms: query, format: 'json' });
    if (dateRange?.start) params.set('dateFilterType', 'range');
    // ...
  },
});

export const computeRelationship = tool({
  description: 'Compute and explain the relationship between two people in the tree',
  parameters: z.object({
    person1Id: z.string().describe('First person ID'),
    person2Id: z.string().describe('Second person ID'),
  }),
  execute: async ({ person1Id, person2Id }) => {
    // Use the path-finding CTE from data model
    // Compute relationship label (e.g., "2nd cousin once removed")
  },
});

export const analyzeTreeGaps = tool({
  description: 'Analyze the family tree for research gaps and suggest priorities',
  parameters: z.object({
    personId: z.string().optional().describe('Focus on a specific person\'s line'),
    maxGenerations: z.number().default(5).describe('How many generations to analyze'),
  }),
  execute: async ({ personId, maxGenerations }) => {
    // Query ancestor tree to specified depth
    // Identify: missing birth/death dates, missing parents,
    // missing sources, dead ends with no further ancestors
    // Return prioritized list of gaps
  },
});

export const explainRecord = tool({
  description: 'Explain a historical record in context — what it means, what to look for',
  parameters: z.object({
    recordType: z.string().describe('Type of record (census, will, ship manifest, etc.)'),
    recordContent: z.string().describe('Text or summary of the record'),
    year: z.number().optional().describe('Year of the record'),
    location: z.string().optional().describe('Location of the record'),
  }),
  execute: async ({ recordType, recordContent, year, location }) => {
    // Return structured explanation with historical context
    return {
      explanation: '', // Claude will generate this based on the record
      historicalContext: '', // What was happening in that time/place
      relatedRecords: [], // What other records to look for
    };
  },
});

export const proposeRelationship = tool({
  description: 'Propose a relationship between two people based on discovered evidence. Creates a pending proposal for editor validation — does NOT directly modify the family tree.',
  parameters: z.object({
    person1Id: z.string().describe('First person ID (parent for parent-child)'),
    person2Id: z.string().describe('Second person ID (child for parent-child)'),
    relationshipType: z.enum(['parent_child', 'partner', 'sibling'])
      .describe('Type of relationship discovered'),
    evidence: z.string().describe('Summary of evidence supporting this relationship'),
    confidence: z.number().min(0).max(1).describe('Confidence level 0-1'),
    sourceRecordId: z.string().optional().describe('ID of the source record that supports this'),
  }),
  execute: async ({ person1Id, person2Id, relationshipType, evidence, confidence, sourceRecordId }) => {
    // Insert into proposed_relationships table
    // source_type = 'ai_suggestion'
    // source_detail = evidence summary + sourceRecordId
    // Notify editors via activity feed
    // Return the proposal ID and status
  },
});
```

## Context Injection Strategy

Claude's context window has limits. For a large tree (1000+ persons), we can't send the entire database. Strategy:

```typescript
// packages/ai/context/tree-context.ts

export interface TreeContext {
  summary: string;           // 1-2 paragraph overview
  keyPersons: PersonSummary[];  // Max 50 persons (direct line + close relatives)
  gaps: string[];             // Top 10 research gaps
  recentActivity: string[];   // Last 5 research actions
  tokenBudget: number;        // Target ~2000 tokens for context
}

export async function buildTreeContext(
  db: DrizzleDatabase,
  focusPersonId?: string,
  tokenBudget = 2000
): Promise<TreeContext> {
  // 1. Get tree statistics
  const stats = await getTreeStats(db);

  // 2. Get direct line from focus person (or tree root)
  const rootId = focusPersonId || await findRootPerson(db);
  const directLine = await getAncestors(db, rootId, 5); // 5 generations

  // 3. Summarize
  const summary = `Family tree with ${stats.personCount} persons spanning ` +
    `${stats.generationCount} generations. Earliest ancestor: ` +
    `${stats.earliestAncestor?.name} (${stats.earliestAncestor?.birthYear}). ` +
    `${stats.sourcedPercentage}% of facts are sourced.`;

  // 4. Key persons (prioritize direct line, then close relatives)
  const keyPersons = directLine.slice(0, 50).map(p => ({
    id: p.id,
    name: `${p.given_name} ${p.surname}`,
    birthYear: p.birthYear,
    deathYear: p.deathYear,
    birthPlace: p.birthPlace,
    generation: p.generation,
  }));

  // 5. Identify gaps
  const gaps = await identifyResearchGaps(db, directLine);

  return { summary, keyPersons, gaps: gaps.slice(0, 10), recentActivity: [], tokenBudget };
}
```

## Model Selection per Task

Choose the appropriate Claude model based on task complexity and cost:

| Task | Model | Rationale |
|------|-------|-----------|
| Quick lookups ("when was X born?") | Claude Haiku | Fast, cheap, sufficient |
| Record explanation | Claude Sonnet | Good balance of quality/cost |
| Research planning | Claude Sonnet | Needs reasoning |
| Document analysis (OCR output) | Claude Sonnet | Needs entity extraction |
| Complex relationship analysis | Claude Opus | Highest quality reasoning |
| Biography generation | Claude Sonnet | Creative + factual |

## Cost Tracking

Track AI API spend to keep costs transparent and manageable.

```typescript
// packages/ai/context/cost-tracker.ts

export interface UsageRecord {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  taskType: string;
}

const PRICING = {
  'claude-haiku-4-5': { input: 0.80, output: 4.00 },     // per million tokens
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

// Budget alert: warn when monthly spend exceeds threshold
export async function checkBudget(db: DrizzleDatabase, monthlyLimitUsd = 10): Promise<{
  spent: number;
  remaining: number;
  overBudget: boolean;
}> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const records = await db.select()
    .from(usageTable)
    .where(gte(usageTable.timestamp, monthStart.toISOString()));

  const spent = records.reduce((sum, r) => sum + r.costUsd, 0);

  return {
    spent,
    remaining: Math.max(0, monthlyLimitUsd - spent),
    overBudget: spent > monthlyLimitUsd,
  };
}
```

## Integration with Relationship Validation

When Claude discovers or suggests a relationship between two people, it uses the `proposeRelationship` tool to create a **pending proposal** in the database. This never directly modifies the `families` or `children` tables.

The flow:
1. AI analyzes records and finds evidence of a parent-child relationship
2. Calls `proposeRelationship` tool with evidence summary and confidence score
3. Database creates entry in `proposed_relationships` table with status='pending'
4. Editor sees proposal in validation queue with evidence and source record links
5. Editor can accept (moves to `families`/`children`), reject, or request more info
6. Upon acceptance, relationship is confirmed and `relationship_justifications` record captures the editor's reasoning

This ensures humans remain in control of the tree structure while AI acts as a powerful research assistant.

## Key Integration Patterns

### Streaming Responses

Use Vercel AI SDK's streaming capability for responsive chat:

```typescript
// apps/web/app/api/ai/chat/route.ts

export async function POST(req: Request) {
  const { messages } = await req.json();

  const treeContext = await buildTreeContext(db, session.user.focusPersonId);

  const result = await generateText({
    model: claude('claude-sonnet-4-6'),
    messages,
    system: buildSystemPrompt(treeContext),
    tools: [
      searchLocalTree,
      searchFamilySearch,
      searchNARA,
      searchNewspapers,
      computeRelationship,
      analyzeTreeGaps,
      explainRecord,
      proposeRelationship,
    ],
  });

  return new StreamingTextResponse(result.toAIStream());
}
```

### Document Analysis

Extract genealogical entities from OCR'd documents:

```typescript
// packages/ai/tools/entity-extraction.ts

const EXTRACTION_PROMPT = `Extract structured genealogical data from this OCR text.
Return JSON with persons (name, role, age), events (type, date, place),
and relationships (person1, person2, type). Be conservative -- only extract
data you're confident about. Mark confidence 0-1.

Document type: {documentType}
OCR Text: {ocrText}`;
```

### Privacy-Aware Responses

The system prompt includes:
> **Privacy-aware.** Never share details about living persons.

The `filterForPrivacy` function (from [data model](data-model.md)) strips living persons from search results before they reach the AI. Claude will see "Living Person" instead of names for anyone presumed alive.

## AI-Powered Features by Phase

| Phase | Feature | Tool | Input | Output |
|-------|---------|------|-------|--------|
| **Phase 2** | Research assistant | Claude Sonnet + tools | Natural language question | Research suggestions + record proposals |
| **Phase 2** | Record matching explanations | Claude Sonnet | Match candidate + local person | Explanation of match evidence |
| **Phase 2** | Research gap analysis | Claude Haiku | Tree structure | Prioritized gaps ("missing grandparents on maternal line") |
| **Phase 3** | Document entity extraction | Claude Sonnet | OCR text + document type | Structured persons, events, relationships |
| **Phase 3** | Source citation generation | Claude Haiku | Document metadata | Formatted citations in Chicago/APA style |
| **Phase 5** | Ancestor biography generation | Claude Sonnet | Person + events + sources | Narrative biography for printing |

---

## Related Documentation

- [Product Vision](../vision.md) — AI capabilities as core value prop
- [Architecture Overview](overview.md) — How AI integrates with Next.js API routes
- [Data Model](data-model.md) — Relationship validation workflow, proposed_relationships table
