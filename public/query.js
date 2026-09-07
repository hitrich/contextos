// A small, deterministic query language. Quotes group words; filters are ANDed.
export function matches(value, query = '') {
  if (typeof query !== 'string' || query.length > 1000) throw Object.assign(new Error('Query must be at most 1,000 characters.'), { status: 400 });
  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return tokens.every(raw => {
    const token = raw.replaceAll('"', '').toLowerCase();
    const split = token.indexOf(':');
    const key = token.slice(0, split), filter = token.slice(split + 1);
    const fields = { type: value.type, namespace: value.namespace, agent: value.agent || value.actor, action: value.action, locked: String(value.locked), tag: value.tags?.join(' '), path: value.path };
    if (split > 0 && Object.hasOwn(fields, key)) return String(fields[key] || '').toLowerCase().includes(filter);
    return JSON.stringify(value).toLowerCase().includes(token);
  });
}
