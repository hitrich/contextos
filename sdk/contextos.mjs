/** Small, dependency-free client for the trusted localhost owner API. */
export class ContextOS {
  constructor(url = 'http://127.0.0.1:3000') { this.url = url.replace(/\/$/, ''); }
  async request(path, method = 'GET', body) {
    const response = await fetch(`${this.url}/api${path}`, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `ContextOS returned ${response.status}`);
    return data;
  }
  recall(query = '') { return this.request(`/memories?q=${encodeURIComponent(query)}`); }
  get(id) { return this.request(`/memories/${encodeURIComponent(id)}`); }
  remember(memory) { return this.request(memory.id ? `/memories/${encodeURIComponent(memory.id)}` : '/memories', memory.id ? 'PUT' : 'POST', memory); }
  history(query = '') { return this.request(`/events?q=${encodeURIComponent(query)}`); }
  handoff(packet) { return this.request('/handoffs', 'POST', packet); }
  export() { return this.request('/export'); }
  import(archive) { return this.request('/import', 'POST', archive); }
  tool(name, args = {}, agent = 'opencode') { return this.request('/tools/call', 'POST', { name, arguments: args, agent }); }
}
