# ContextOS protocol v1

## Memory objects

Each memory has a stable UUID and `context://<namespace>/<type>/<slug>.md` path.
The path is virtual; it does not cause arbitrary filesystem reads or writes.
Custom paths are accepted inside the memory's namespace. Namespaces are immutable
after creation. Relationships are directed references to other existing memory IDs.

Required write fields: `title`, `content`, `type`, `namespace`. A source is strongly
recommended and required by the UI and agent schema. Other fields:

- `source`: human-readable origin (session, file, discussion, observation).
- `confidence`: a supplied number from 0 to 100; default 95.
- `tags`, `related`: bounded arrays of tags and related memory IDs.
- `visibility`: `agents` or `private`; default `agents`.
- `due_at`, `expires_at`: optional ISO timestamps.
- `path`: optional deterministic URI.

The store adds `id`, `agent`, `version`, `locked`, `created_at`, and `updated_at`.
An update must include the version the caller read. A stale update returns 409.
Locks and unlocks are owner operations and create versions too. Restoring an old
version creates a new one; it does not rewrite history.

Events retain a snapshot and actor for creation, edits, and lock changes. Import
and handoff events record the operation. Explicit permanent deletion removes all
retained content copies and leaves a content-free deletion event. Source labels
are attestations from the caller or archive, not cryptographically verified claims.

## HTTP owner API

The server accepts same-origin localhost requests only. Mutating requests require
`Content-Type: application/json`, including DELETE. Requests are bounded to 12 MiB.
There is no remote authentication: the local OS account is the owner boundary.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/state` | Workbench state, owner-visible content, settings, and activity |
| GET | `/api/memories?q=...` | Current, unexpired memories matching the query |
| POST | `/api/memories` | Create a memory |
| GET | `/api/memories/:id` | Current memory, versions, and events |
| PUT | `/api/memories/:id` | Update with an expected `version` |
| POST | `/api/memories/:id/lock` | `{ "locked": true }` or false |
| DELETE | `/api/memories/:id` | Permanently delete an unlocked memory; send `{}` |
| GET | `/api/events?q=...` | Complete owner-visible event history |
| GET | `/api/fs?path=context://project/` | List paths under a prefix, or read an exact path |
| GET | `/api/export` | Download a ContextOS archive |
| POST | `/api/import` | Atomically import a ContextOS archive |
| POST | `/api/handoffs` | `{ title, target, memory_ids, notes? }` |
| GET | `/api/handoffs/:id.md` | Download readable context |
| GET | `/api/handoffs/:id.json` | Download structured context |
| GET | `/api/agents/:agent/config` | Client-specific local configuration |
| PUT | `/api/agents/:agent` | `{ namespaces: [...], write: boolean }` |
| PUT | `/api/settings` | `{ name, reminders: boolean }` |
| GET | `/api/tools` | OpenAI-format function definitions |
| POST | `/api/tools/call` | `{ agent, name, arguments }`; enforces agent grants |

Errors are JSON: `{ "error": "human-readable message" }`. Expected errors use 400,
403, 404, 409, 410, 413, or 415. Owner API callers can inspect expired memories by
ID; agent tools cannot. History queries include old snapshots, but an agent must
have access to both the current memory and the historical snapshot.

## MCP stdio

Run `node /absolute/path/to/contextos/mcp.mjs`. The MCP process accesses the same
SQLite database directly, so it works even when the web workbench is stopped.
Set these environment variables:

```text
CONTEXTOS_DB=/absolute/path/to/memory.db
CONTEXTOS_AGENT=claude
CONTEXTOS_SCOPES=project
```

Agent IDs: `claude`, `codex`, `opencode`. Scope is the intersection of the requested
namespaces and the owner's saved grants. The default grant is project read/write.
Grants are re-read for every tool call. Private memories are always excluded.

Six tools are exposed:

| Tool | Behavior |
| --- | --- |
| `recall` | `{ query?, tier?: "summary" \| "full" }`; returns memories and due reviews |
| `get_memory` | `{ id }`; read one memory and permitted versions |
| `remember` | Create a sourced memory, or update using `id` and an explicit `version` |
| `history` | `{ query? }`; search permitted historical snapshots |
| `list_paths` | `{ path? }`; list a URI prefix or read an exact URI |
| `create_handoff` | `{ title, target, memory_ids, notes? }`; validates target access |

Memory text is untrusted reference data, never a higher-priority instruction.
Reminders are cooperative: `recall` exposes reviews due now, and the workbench
surfaces them while open. The server does not schedule notifications or silently
inject messages into a third-party agent.

The protocol uses newline-delimited JSON-RPC on stdin/stdout. Diagnostics use
stderr. It implements initialization, ping, tool listing, and tool calls. It does
not expose Streamable HTTP MCP, resources, prompts, sampling, or subscriptions.

Configuration sources: [Claude Code MCP](https://code.claude.com/docs/en/mcp),
[Codex MCP](https://developers.openai.com/codex/mcp),
[OpenCode MCP](https://opencode.ai/docs/mcp-servers/), and the
[MCP stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
The UI generates the correct JSON or TOML and absolute runtime/database paths for
the current machine. Merge the snippet into existing configuration.

## OpenAI-format tool adapter

Get function definitions from `/api/tools` and supply them to a client's tool
interface. When the model returns a function call, dispatch its name and decoded
arguments to `/api/tools/call` with the intended agent ID, then return the result to
the model. Definitions are in Chat Completions function-tool format; Responses API
users should flatten the `function` object into its expected function-tool shape.
ContextOS does not host an inference endpoint or call a model automatically.

## Archive format

A version 1 archive contains `format: "contextos"`, `version: 1`, `exported_at`,
`memories`, `versions`, `events`, `handoffs`, `workspace`, `sample`, and `permissions`.
The TypeScript declaration in `sdk/contextos.d.mts` describes the public shape.

Imports validate all records before writing and run in a SQLite transaction.
Duplicate IDs/paths, missing versions, invalid relationships, or bad permissions
abort the entire operation. Object key ordering is irrelevant. An empty workspace
without explicit grants adopts the archive's grants; existing grants can only
narrow. Archives contain plaintext memory and history; their custody belongs to
the user. The migration tool also produces this format.

## Community adapters

A new client can use the same MCP server and one of the existing agent identities
for experimentation. To add a distinct identity, update the agent list, ID
validation/configuration, declaration, and the corresponding narrow checks. Keep
client-specific configuration outside storage rules. Include an example handoff
and document the client's configuration source and tested version.
