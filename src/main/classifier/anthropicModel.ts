// Issue #17: ClassifierModel backed by the Claude API (structured outputs).
import type Anthropic from '@anthropic-ai/sdk';
import { CLASSIFIER_MODEL } from '../../shared/constants';
import { notImplemented } from '../../shared/notImplemented';
import type { ClassifierModel } from './classify';

export interface AnthropicModelOptions {
  model?: string;
  maxTokens?: number;
}

/**
 * Calls client.messages.parse with zodOutputFormat(ClassificationSchema) and
 * returns parsed_output; returns null on stop_reason "refusal".
 */
export function createAnthropicClassifierModel(
  client: Anthropic,
  { model = CLASSIFIER_MODEL, maxTokens = 4096 }: AnthropicModelOptions = {},
): ClassifierModel {
  return notImplemented(`createAnthropicClassifierModel(${typeof client}, ${model}, ${maxTokens})`);
}
