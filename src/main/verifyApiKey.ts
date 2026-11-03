// Checks an Anthropic API key with one cheap, free request before saving it.
import Anthropic from '@anthropic-ai/sdk';
import { CLASSIFIER_MODEL } from '../shared/constants';
import type { KeyVerdict } from './settings';

export async function verifyAnthropicApiKey(apiKey: string): Promise<KeyVerdict> {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 15_000 });
  try {
    await client.models.retrieve(CLASSIFIER_MODEL);
    return 'valid';
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return 'invalid';
    }
    // Offline, rate limited or an outage: the key may still be fine.
    return 'unknown';
  }
}
