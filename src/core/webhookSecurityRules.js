export function canonicalTwilioWebhookPayload(url, params = {}) {
  const entries = params instanceof Map
    ? Array.from(params.entries())
    : Array.isArray(params)
      ? params
      : Object.entries(params || {});

  return entries
    .map(([key, value]) => [String(key), String(value ?? '')])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .reduce((acc, [key, value]) => `${acc}${key}${value}`, String(url || ''));
}

export function shortSensitiveId(value, visible = 8) {
  const v = String(value || '');
  const n = Math.max(1, Number.isFinite(Number(visible)) ? Number(visible) : 8);
  return v.length > n ? `...${v.slice(-n)}` : v;
}
