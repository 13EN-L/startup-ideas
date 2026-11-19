// Issue #17: ClassifierModel backed by the Claude API (structured outputs).
import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { CLASSIFIER_MODEL } from '../../shared/constants';
import type { ClassifierModel } from './classify';
import { ClassificationSchema } from './schema';

export interface AnthropicModelOptions {
  model?: string;
  maxTokens?: number;
}

/**
 * Calls client.messages.parse with zodOutputFormat(ClassificationSchema) and
 * returns parsed_output; returns null on stop_reason "refusal" so the retry
 * loop treats it like any other unusable answer.
 */
export function createAnthropicClassifierModel(
  client: Anthropic,
  { model = CLASSIFIER_MODEL, maxTokens = 4096 }: AnthropicModelOptions = {},
): ClassifierModel {
  return {
    async complete({ system, messages }) {
      const response = await client.messages.parse({
        model,
        max_tokens: maxTokens,
        system,
        messages,
        // Labelling a short list is a light task; low effort keeps it fast and cheap.
        output_config: { effort: 'low', format: zodOutputFormat(ClassificationSchema) },
      });
      if (response.stop_reason === 'refusal') return null;
      return response.parsed_output ?? null;
    },
  };
}
