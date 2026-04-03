import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV3 } from '@ai-sdk/provider';

/**
 * Create an Anthropic model instance for use with the Vercel AI SDK.
 * Reads ANTHROPIC_API_KEY from environment.
 */
export function createAnthropicClient() {
  return createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

/**
 * Pre-configured model instances for different task types.
 */
export function getModel(task: 'chat' | 'extraction' | 'analysis' | 'citation' = 'chat'): LanguageModelV3 {
  const anthropic = createAnthropicClient();

  switch (task) {
    case 'extraction':
      // Haiku for cost-efficient extraction tasks
      return anthropic('claude-haiku-4-5');
    case 'analysis':
      // Sonnet for balanced quality/cost analysis
      return anthropic('claude-sonnet-4-5');
    case 'citation':
      // Haiku for quick citation generation
      return anthropic('claude-haiku-4-5');
    case 'chat':
    default:
      // Sonnet as default for research chat
      return anthropic('claude-sonnet-4-5');
  }
}
