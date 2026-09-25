import { describe, it, expect, vi } from 'vitest';
import { createAssistantHandler } from '../../../supabase/functions/assistant-help/handler.js';
import { requestAssistantHelp } from '../../../src/features/assistant/assistantAiClient.js';

const payload = { answer: 'Ouvre le module Patrimoine.', view: 'assets' };
const response = (overrides = {}) => new Response(JSON.stringify({ status: 'completed', output: [
  { type: 'reasoning', summary: [] }, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(payload) }] },
], ...overrides }));
function setup(overrides = {}) {
  const deps = { authenticate: vi.fn(async () => 'user-1'), reserveQuota: vi.fn(async () => true),
    apiKey: 'test-secret', enabled: true, allowedUsers: ['user-1'], fetchImpl: vi.fn(async () => response()), ...overrides };
  return { ...deps, handler: createAssistantHandler(deps) };
}
const request = (body = { question: 'Comment suivre mon patrimoine ?', language: 'fr', view: 'assets' }) => new Request('https://test.local', {
  method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(body),
});

describe('assistant server boundaries', () => {
  it('uses Responses and ignores injected configuration/history/data', async () => {
    const deps = setup();
    const result = await deps.handler(request({ question: 'Help', language: 'en', view: 'settings', model: 'evil', userId: 'other', history: ['secret'], snapshot: { balance: 999 } }));
    expect(await result.json()).toEqual({ ...payload, source: 'ai' });
    const [url, options] = deps.fetchImpl.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(body).toMatchObject({ model: 'gpt-6-sol', store: false, reasoning: { effort: 'low' }, max_output_tokens: 1200 });
    expect(body.temperature).toBeUndefined();
    expect(JSON.parse(body.input)).toEqual({ question: 'Help', language: 'en', view: 'settings' });
    expect(deps.reserveQuota).toHaveBeenCalledWith('user-1');
  });
  it.each([
    ['unauthenticated', { authenticate: async () => null }, 401],
    ['disabled', { enabled: false }, 503], ['missing key', { apiKey: '' }, 503],
    ['outside pilot', { allowedUsers: ['other'] }, 503], ['quota', { reserveQuota: async () => false }, 429],
  ])('never calls OpenAI when %s', async (_, overrides, status) => {
    const deps = setup(overrides);
    expect((await deps.handler(request())).status).toBe(status);
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each([{}, { question: ' ' }, { question: 'a'.repeat(1501) }])('rejects invalid question %j', async body => {
    const deps = setup();
    expect((await deps.handler(request(body))).status).toBe(400);
    expect(deps.reserveQuota).not.toHaveBeenCalled();
  });
  it('limits actual request bytes', async () => {
    const deps = setup();
    expect((await deps.handler(request({ question: 'a', extra: 'x'.repeat(9000) }))).status).toBe(413);
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });
  it.each([
    { status: 'incomplete' }, { output: [] },
    { output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'No' }] }] },
    { output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"answer":"Hi","view":"https://evil"}' }] }] },
  ])('fails closed on incomplete or invalid model output', async overrides => {
    const deps = setup({ fetchImpl: async () => response(overrides) });
    expect((await deps.handler(request())).status).toBe(503);
  });
  it('does not expose upstream errors or retry', async () => {
    const deps = setup({ fetchImpl: vi.fn(async () => new Response('test-secret', { status: 429 })) });
    const result = await deps.handler(request());
    expect(await result.text()).not.toContain('test-secret');
    expect(deps.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('aborts a slow upstream request', async () => {
    const deps = setup({ timeoutMs: 5, fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')))) });
    expect((await deps.handler(request())).status).toBe(503);
  });
});

describe('assistant client', () => {
  it('sends only the question, language and allowed view', async () => {
    const invoke = vi.fn(async () => ({ data: { ...payload, source: 'ai' } }));
    expect(await requestAssistantHelp({ client: { functions: { invoke } }, question: ' Help ', language: 'en', view: 'unknown', snapshot: { private: 1 } })).toEqual({ ...payload, source: 'ai' });
    expect(invoke.mock.calls[0][1].body).toEqual({ question: 'Help', language: 'en', view: 'help' });
  });
  it('times out even if transport ignores the signal', async () => {
    await expect(requestAssistantHelp({ client: { functions: { invoke: () => new Promise(() => {}) } }, question: 'Help', timeoutMs: 5 })).rejects.toThrow('AI_CANCELLED');
  });
  it('rejects an external navigation destination', async () => {
    await expect(requestAssistantHelp({ client: { functions: { invoke: async () => ({ data: { ...payload, source: 'ai', view: 'javascript:evil' } }) } }, question: 'Help' })).rejects.toThrow();
  });
});
