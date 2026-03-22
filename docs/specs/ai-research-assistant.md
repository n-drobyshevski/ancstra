# AI Research Assistant

> Phase: 3 | Status: Not Started
> Depth: design-level
> Dependencies: [ai-strategy.md](../architecture/ai-strategy.md), [familysearch-api.md](familysearch-api.md), [document-processing.md](document-processing.md)
> Data model: none (stateless tool execution)

## Overview

An intelligent genealogy co-pilot powered by Claude (Vercel AI SDK) with tool-calling capability. Knows the user's family tree context and can query FamilySearch, NARA, newspapers, and the local database to answer research questions, propose relationships, and suggest next steps.

## Requirements

- [ ] System prompt with dynamic tree context injection
- [ ] Tool definitions for tree search, FamilySearch, NARA, newspapers
- [ ] Relationship computation and tree gap analysis tools
- [ ] Context window budget (~2000 tokens for tree context)
- [ ] Streaming responses via Vercel AI SDK
- [ ] Model selection per task (Haiku for simple, Sonnet for reasoning, Opus for complex)
- [ ] Cost tracking and monthly budget enforcement
- [ ] Tool outputs sanitized for privacy (no living person details)
- [ ] Proposed relationships creation (pending approval workflow)

## Design

### Architecture

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
│  │  System prompt with tree context:      │  │
│  │  - Tree summary (stats, root, gaps)    │  │
│  │  - Key persons (50 max, direct line)   │  │
│  │  - Research gaps (top 10)              │  │
│  │  - Research methodology guidelines     │  │
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

### System Prompt

Template with injected tree context:

```typescript
function buildSystemPrompt(treeContext: TreeContext): string {
  return `You are a genealogy research assistant with deep knowledge of historical
records, research methodology, and the user's family tree.

[Your Family Tree Context]
${treeContext.summary}

[Key People - direct line + close relatives]
${treeContext.keyPersons.map(p =>
  `- ${p.name} (${p.birthYear||'?'}–${p.deathYear||'?'}), ${p.birthPlace||'unknown'}`
).join('\n')}

[Research Gaps]
${treeContext.gaps.map(g => `- ${g}`).join('\n')}

[Guidelines]
1. Documents are source of truth — cite specific records
2. Be specific about uncertainty ("this suggests..." not "was...")
3. Explain reasoning — show evidence chain
4. Suggest next steps after answering
5. Consider historical context (spelling, borders, calendars)
6. Privacy-aware — never share living person details
7. Use tools proactively for real data`
}
```

### Tool Definitions

**Search and Analysis:**

```typescript
tool: searchLocalTree({
  givenName?: string
  surname?: string
  birthYear?: number
  birthPlace?: string
  query?: string
})

tool: searchFamilySearch({
  givenName: string
  surname: string
  birthDate?: string      // year or full date
  birthPlace?: string
  deathDate?: string
  deathPlace?: string
  recordType?: 'census' | 'vital' | 'military' | 'immigration' | 'church' | 'any'
})

tool: searchNARA({
  query: string
  resultType?: 'all' | 'item' | 'fileUnit' | 'series'
})

tool: searchNewspapers({
  query: string
  dateRange?: { start?: string; end?: string }  // YYYY format
  state?: string
})

tool: computeRelationship({
  person1Id: string
  person2Id: string
})

tool: analyzeTreeGaps({
  personId?: string
  maxGenerations?: number  // default 5
})

tool: explainRecord({
  recordType: string
  recordContent: string
  year?: number
  location?: string
})

tool: proposeRelationship({
  person1Id: string
  person2Id: string
  relationshipType: 'parent_child' | 'partner' | 'sibling'
  evidence: string                    // summary of evidence
  confidence: number                  // 0-1
  sourceRecordId?: string
})
```

All tools return structured JSON. Relationship proposals create pending entries in `proposed_relationships` (do NOT directly modify family structure).

### Context Injection Strategy

Tree context budget: ~2000 tokens for large trees (1000+ persons).

```typescript
interface TreeContext {
  summary: string              // 1-2 paragraphs: stats, root, generation span
  keyPersons: PersonSummary[]  // Max 50: direct line + close relatives
  gaps: string[]              // Top 10 research gaps identified
  recentActivity: string[]    // Last 5 research actions
  tokenBudget: number         // Target tokens for context
}

async function buildTreeContext(
  db: DrizzleDatabase,
  focusPersonId?: string,
  tokenBudget = 2000
): Promise<TreeContext>
```

**Algorithm:**
1. Fetch tree statistics (total persons, generation count, earliest ancestor)
2. Get direct line from focus person (5 generations default)
3. Summarize: overall stats + earliest ancestor + sourcing percentage
4. Extract key persons: direct line (max 50)
5. Identify research gaps (missing dates, missing parents, dead ends, unsourced facts)

### Model Selection

| Task | Model | Rationale |
|------|-------|-----------|
| Quick lookups | Claude Haiku | Fast, cheap, sufficient |
| Record explanation | Claude Sonnet | Good quality/cost balance |
| Research planning | Claude Sonnet | Needs reasoning |
| Document analysis (OCR) | Claude Sonnet | Entity extraction |
| Complex relationships | Claude Opus | Highest quality reasoning |
| Biography generation | Claude Sonnet | Creative + factual |

### Cost Tracking

Monthly budget enforcement with per-task pricing:

```typescript
const PRICING = {
  'claude-haiku-4-5': { input: 0.80, output: 4.00 },     // per million
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number

async function checkBudget(db: DrizzleDatabase, monthlyLimitUsd = 10):
  Promise<{ spent: number; remaining: number; overBudget: boolean }>
```

## Edge Cases & Error Handling

- **Large tree context overflow:** Reduce key persons or use tree root as focus
- **No results:** Suggest alternative search terms or missing data
- **Tool failure:** Return error message; Claude re-attempts with different approach
- **Privacy violation:** Filter living persons from search results
- **Confidence threshold:** Propose relationships only if confidence >= 0.5

## Open Questions

- Caching strategy for frequently analyzed trees?
- Custom fine-tuning on genealogy terminology for cost reduction?
- Real-time hints as user types (or batch on save)?
- Integration with family member feedback for model improvement?

## Implementation Notes

Location: `packages/ai/`, `apps/web/api/research/*`

Key files:
- `prompts/research-assistant.ts` - System prompt builder
- `tools/genealogy-tools.ts` - Tool definitions
- `context/tree-context.ts` - Context builder and budget management
- `context/cost-tracker.ts` - Usage tracking and budget alerts
