import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, AppError, AGENTS, handoffMarkdown } from './core.mjs';
import { seed } from './seed.mjs';
import { definitions, callTool } from './tools.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const database = resolve(process.env.CONTEXTOS_DB || '.contextos/memory.db');
const store = new Store(database);
if (process.argv.includes('--demo')) seed(store);
const port = Number(process.env.PORT || 3000);
const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown', '.ttf': 'font/ttf' };
const json = (response, value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };

async function body(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new AppError('Use application/json.', 415);
  const chunks = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > 12 * 1024 * 1024) throw new AppError('Maximum request size is 12 MiB.', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError('Invalid JSON.'); }
}
function config(agent) {
  const env = { CONTEXTOS_DB: database, CONTEXTOS_AGENT: agent.id, CONTEXTOS_SCOPES: agent.namespaces.join(',') };
  const command = process.execPath, args = [resolve(root, 'mcp.mjs')];
  if (agent.id === 'codex') return { file: '~/.codex/config.toml', code: `[mcp_servers.contextos]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\n\n[mcp_servers.contextos.env]\n${Object.entries(env).map(([k,v]) => `${k} = ${JSON.stringify(v)}`).join('\n')}\n`, language: 'toml' };
  const data = agent.id === 'claude' ? { mcpServers: { contextos: { command, args, env } } } : { mcp: { contextos: { type: 'local', command: [command, ...args], environment: env, enabled: true } } };
  return { file: agent.id === 'claude' ? '.mcp.json' : 'opencode.json', code: JSON.stringify(data, null, 2), language: 'json' };
}
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    if (!allowedHosts.has(request.headers.host) || (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) || request.headers['sec-fetch-site'] === 'cross-site') throw new AppError('Only same-origin, local requests are allowed.', 403);
    const url = new URL(request.url, `http://${request.headers.host}`), path = decodeURIComponent(url.pathname), method = request.method;
    if (path === '/api/state' && method === 'GET') return json(response, { memories: store.list('', undefined, { includeExpired: true }), events: store.history(), agents: store.agents(), handoffs: store.handoffs(), workspace: store.setting('workspace', { name: 'Personal workspace', reminders: true }), sample: store.setting('sample', false), database, storage_bytes: (await stat(database)).size, server_time: new Date().toISOString() });
    if (path === '/api/memories' && method === 'GET') return json(response, store.list(url.searchParams.get('q') || ''));
    if (path === '/api/memories' && method === 'POST') return json(response, store.save(await body(request)), 201);
    const memoryMatch = path.match(/^\/api\/memories\/([^/]+)(\/lock)?$/);
    if (memoryMatch) {
      const id = memoryMatch[1];
      if (memoryMatch[2] && method === 'POST') return json(response, store.lock(id, (await body(request)).locked));
      if (!memoryMatch[2] && method === 'GET') return json(response, { memory: store.get(id), versions: store.versions(id), events: store.history().filter(e => e.memory_id === id) });
      if (!memoryMatch[2] && method === 'PUT') return json(response, store.save(await body(request), undefined, id));
      if (!memoryMatch[2] && method === 'DELETE') { await body(request); store.remove(id); return json(response, { deleted: true }); }
    }
    if (path === '/api/events' && method === 'GET') return json(response, store.history(url.searchParams.get('q') || ''));
    if (path === '/api/fs' && method === 'GET') return json(response, callTool(store, 'list_paths', { path: url.searchParams.get('path') || 'context://' }, store.actor()));
    if (path === '/api/export' && method === 'GET') { response.setHeader('Content-Disposition', 'attachment; filename="contextos-archive.json"'); return json(response, store.export()); }
    if (path === '/api/import' && method === 'POST') return json(response, store.import(await body(request)));
    if (path === '/api/handoffs' && method === 'POST') return json(response, store.handoff(await body(request)), 201);
    const handoffMatch = path.match(/^\/api\/handoffs\/([^/]+)\.(md|json)$/);
    if (handoffMatch && method === 'GET') {
      const h = store.handoffs().find(h => h.id === handoffMatch[1]); if (!h) throw new AppError('Handoff not found.', 404);
      response.setHeader('Content-Disposition', `attachment; filename="contextos-handoff.${handoffMatch[2]}"`);
      if (handoffMatch[2] === 'json') return json(response, h);
      response.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' }); return response.end(handoffMarkdown(h));
    }
    const agentMatch = path.match(/^\/api\/agents\/(claude|codex|opencode)(\/config)?$/);
    if (agentMatch) {
      if (method === 'GET' && agentMatch[2]) return json(response, config(store.agents().find(a => a.id === agentMatch[1])));
      if (method === 'PUT' && !agentMatch[2]) return json(response, store.grant(agentMatch[1], await body(request)));
    }
    if (path === '/api/settings' && method === 'PUT') {
      const input = await body(request);
      if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 70 || typeof input.reminders !== 'boolean') throw new AppError('Enter a workspace name and valid reminder preference.');
      return json(response, store.setSetting('workspace', { name: input.name.trim(), reminders: input.reminders }));
    }
    if (path === '/api/tools' && method === 'GET') return json(response, definitions.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })));
    if (path === '/api/tools/call' && method === 'POST') {
      const input = await body(request);
      if (!AGENTS.some(a => a.id === (input.agent || 'opencode'))) throw new AppError('Unknown agent.');
      const actor = store.actor(input.agent || 'opencode', input.scopes);
      store.touch(actor.id); return json(response, callTool(store, input.name, input.arguments, actor));
    }
    if (path.startsWith('/api/')) throw new AppError('API route not found.', 404);
    if (!['GET', 'HEAD'].includes(method)) throw new AppError('Method not allowed.', 405);
    const file = path === '/' ? 'index.html' : path.slice(1);
    if (!/^[a-zA-Z0-9_./-]+$/.test(file) || file.split('/').some(p => p.startsWith('.'))) throw new AppError('Not found.', 404);
    let data;
    try { data = await readFile(resolve(root, 'public', file)); } catch { throw new AppError('Not found.', 404); }
    response.writeHead(200, { 'Content-Type': `${mime[extname(file)] || 'application/octet-stream'}; charset=utf-8` });
    response.end(method === 'HEAD' ? undefined : data);
  } catch (error) {
    const status = error.status || (error.code?.startsWith('SQLITE_CONSTRAINT') ? 409 : 500);
    if (status === 500) console.error(error);
    if (!response.headersSent) json(response, { error: status === 500 ? 'The operation could not be completed. Your existing data is safe.' : error.message }, status);
    else response.end();
  }
});
server.listen(port, '127.0.0.1', () => console.log(`ContextOS → http://localhost:${port}\nDatabase: ${database}${store.setting('sample') ? '\nSample workspace (fictional data)' : ''}`));
server.on('error', error => { console.error(error.message); store.close(); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
