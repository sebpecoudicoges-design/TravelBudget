import { describe, expect, it } from 'vitest';
import { canonicalTwilioWebhookPayload, shortSensitiveId } from '../../src/core/webhookSecurityRules.js';

describe('webhook security rules', () => {
  it('builds Twilio canonical payloads with deterministic case-sensitive sorting', () => {
    const url = 'https://example.com/functions/v1/whatsapp-inbox';
    const params = {
      Body: 'hello',
      MessageSid: 'SM123',
      From: 'whatsapp:+61400000000',
      NumMedia: '0',
    };

    expect(canonicalTwilioWebhookPayload(url, params)).toBe(
      `${url}BodyhelloFromwhatsapp:+61400000000MessageSidSM123NumMedia0`,
    );
  });

  it('redacts sensitive identifiers while keeping useful suffixes', () => {
    expect(shortSensitiveId('SMabcdefghijklmnopqrstuvwxyz')).toBe('...stuvwxyz');
    expect(shortSensitiveId('SM123')).toBe('SM123');
  });
});
