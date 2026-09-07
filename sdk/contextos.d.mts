export type MemoryType = 'semantic' | 'episodic' | 'procedural';
export type Namespace = 'project' | 'user' | 'team';
export type Agent = 'claude' | 'codex' | 'opencode';
export type MemoryInput = {
  id?: string; version?: number; title: string; content: string; type: MemoryType;
  namespace: Namespace; source: string; tags?: string[]; related?: string[];
  confidence?: number; visibility?: 'agents' | 'private'; path?: string;
  due_at?: string | null; expires_at?: string | null;
};
export type Memory = MemoryInput & {
  id: string; version: number; locked: boolean; created_at: string; updated_at: string;
  agent: Agent | 'human'; path: string; confidence: number; tags: string[]; related: string[];
};
export type HandoffInput = { title: string; target: Agent; memory_ids: string[]; notes?: string };
export type Handoff = { id: string; title: string; target: Agent; from: string; notes: string; memories: Memory[]; created_at: string };
export type Event = { id: string; action: string; actor: string; timestamp: string; title: string; memory_id: string | null; snapshot?: Memory };
export type Archive = {
  format: 'contextos'; version: 1; exported_at: string; memories: Memory[]; versions: Memory[];
  events: Event[]; handoffs: Handoff[]; sample: boolean; workspace: { name: string; reminders: boolean };
  permissions: Record<Agent, { namespaces: Namespace[]; write: boolean }>;
};
export class ContextOS {
  constructor(url?: string);
  request(path: string, method?: string, body?: unknown): Promise<unknown>;
  recall(query?: string): Promise<Memory[]>;
  get(id: string): Promise<{ memory: Memory; versions: Memory[]; events: Event[] }>;
  remember(memory: MemoryInput): Promise<Memory>;
  history(query?: string): Promise<Event[]>;
  handoff(packet: HandoffInput): Promise<Handoff>;
  export(): Promise<Archive>;
  import(archive: Archive): Promise<{ imported: number }>;
  tool(name: string, args?: Record<string, unknown>, agent?: Agent): Promise<unknown>;
}
