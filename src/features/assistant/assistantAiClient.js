const VIEWS = new Set(['dashboard', 'transactions', 'analysis', 'assets', 'documents', 'trip', 'settings', 'help']);

export async function requestAssistantHelp({ client, question, language, view, signal, timeoutMs = 25000 }) {
  if (!client?.functions?.invoke || !question?.trim() || question.length > 1500) throw new Error('AI_UNAVAILABLE');
  if (signal?.aborted) throw new Error('AI_CANCELLED');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timer;
  const interrupted = new Promise((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('AI_CANCELLED')), { once: true });
    if (controller.signal.aborted) reject(new Error('AI_CANCELLED'));
    timer = setTimeout(abort, timeoutMs);
  });
  try {
    const { data, error } = await Promise.race([interrupted, client.functions.invoke('assistant-help', {
      body: { question: question.trim(), language: language === 'en' ? 'en' : 'fr', view: VIEWS.has(view) ? view : 'help' },
      signal: controller.signal,
    })]);
    if (error || data?.source !== 'ai' || typeof data.answer !== 'string' || !data.answer.trim()
      || data.answer.length > 4000 || (data.view !== null && !VIEWS.has(data.view))) throw new Error('AI_UNAVAILABLE');
    return data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
