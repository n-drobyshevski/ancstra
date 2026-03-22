import { tool } from 'ai';
import { z } from 'zod';

/** The 17 valid fact types from the research_facts schema. */
const VALID_FACT_TYPES = [
  'name', 'birth_date', 'birth_place', 'death_date', 'death_place',
  'marriage_date', 'marriage_place', 'residence', 'occupation',
  'immigration', 'military_service', 'religion', 'ethnicity',
  'parent_name', 'spouse_name', 'child_name', 'other',
] as const;

type FactType = typeof VALID_FACT_TYPES[number];

interface ExtractedFact {
  factType: FactType;
  factValue: string;
  confidence: 'high' | 'medium' | 'low';
  personId: string;
  researchItemId: string;
  extractionMethod: 'ai_extracted';
}

interface RawAIFact {
  factType: string;
  factValue: string;
  confidence: string;
}

/**
 * Validate whether a string is a valid fact type.
 */
export function validateFactType(type: string): boolean {
  return (VALID_FACT_TYPES as readonly string[]).includes(type);
}

/**
 * Parse and validate AI extraction output into structured facts.
 * Filters out facts with invalid types.
 */
export function parseExtractedFacts(
  aiOutput: RawAIFact[],
  personId: string,
  researchItemId: string
): ExtractedFact[] {
  return aiOutput
    .filter(fact => validateFactType(fact.factType))
    .map(fact => ({
      factType: fact.factType as FactType,
      factValue: fact.factValue,
      confidence: (['high', 'medium', 'low'].includes(fact.confidence)
        ? fact.confidence
        : 'medium') as 'high' | 'medium' | 'low',
      personId,
      researchItemId,
      extractionMethod: 'ai_extracted' as const,
    }));
}

/**
 * Create the extractFacts tool.
 * Uses Claude to extract genealogical facts from text content.
 */
export function createExtractFactsTool() {
  return tool({
    description: 'Extract genealogical facts (names, dates, places, relationships) from text content using AI analysis',
    parameters: z.object({
      text: z.string().describe('The text content to extract facts from'),
      documentType: z.string().optional().describe('Type of document (census, obituary, vital record, etc.)'),
      personContext: z.string().optional().describe('Context about the person this document relates to'),
    }),
    execute: async ({ text, documentType, personContext }) => {
      // This tool returns the text for Claude to analyze in the conversation.
      // The AI model itself will extract facts from the text using its knowledge.
      // The actual extraction prompt is handled by the chat layer.
      return {
        text: text.slice(0, 5000), // Limit text length for token efficiency
        documentType: documentType ?? 'unknown',
        personContext: personContext ?? null,
        instruction: 'Extract genealogical facts from this text. For each fact, provide: factType (one of: name, birth_date, birth_place, death_date, death_place, marriage_date, marriage_place, residence, occupation, immigration, military_service, religion, ethnicity, parent_name, spouse_name, child_name, other), factValue, and confidence (high/medium/low).',
      };
    },
  });
}
