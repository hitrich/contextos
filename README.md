# ContextOS

**Your context, connected.** A portable, inspectable home for everything your agents know.

[![Tests](https://github.com/hitrich/contextos/actions/workflows/test.yml/badge.svg)](https://github.com/hitrich/contextos/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-3c704f.svg)](LICENSE)

ContextOS is a working **local MVP** for developers who move between coding agents.
Keep decisions, experiences, and procedures in one SQLite database. Inspect where
a belief came from, search what it used to say, and take the useful context into
your next agent. No accounts, API keys, package installation, or cloud service required.

## Run it

Requires **Node.js 24+**. Python 3.10+ is needed only for the Python client and its integration check.

```sh
git clone https://github.com/hitrich/contextos.git
cd contextos
npm start
```

Open **[localhost:3000](http://localhost:3000)**. This starts an empty workspace.
To start with 24 clearly labeled fictional memories instead, use `npm run demo`
in place of `npm start`. Demo content is added only to a new, empty database.

```sh
# Optional: choose the database location and port.
CONTEXTOS_DB=/path/to/memory.db PORT=3001 npm start

# Run the storage, HTTP, MCP, SDK, and migration checks.
npm test
```

The default database is `.contextos/memory.db`, relative to the working directory.
There is no frontend build step. The UI uses browser-native modules, CSS, and
vendored Lucide icons. The server uses Node's built-in HTTP and SQLite modules.

## What works today

| Capability | Behavior |
| --- | --- |
| Memory workbench | Overview, list/grid explorer, graph, events, agents, handoffs, and settings; responsive layouts and keyboard-accessible dialogs |
| Structured memories | Semantic facts, episodic experiences, and procedural workflows; project, user, and team namespaces |
| Provenance & versions | Source, author, confidence, timestamps, stable path, relationships, every edit, and restore as a new version |
| Complete history search | Search current content or all recorded versions, with quoted phrases and composable field filters |
| Deterministic retrieval | Browse `context://` paths; choose summary or full content through MCP |
| Human control | Edit, lock, unlock, review, expire, and permanently delete a memory with its retained copies |
| Scoped agent access | Namespace grants, read-only access, private memories, and lock enforcement in the shared store |
| Proactive review | Due memories surface in the workbench and the agent's `recall` response |
| Portable handoffs | Review selected context and next steps; download sourced Markdown or JSON |
| Archives | Atomic, additive JSON import/export with memories, versions, events, handoffs, workspace preferences, and agent permissions |
| Agent adapters | MCP stdio configurations for Claude Code, Codex, and OpenCode; OpenAI-format function definitions for custom clients |
| SDKs & migration | JavaScript with TypeScript declarations, Python stdlib client, and a converter for mem0 JSON exports |

Numbers in the workbench are calculated from the actual local store. Agent status
means a client contacted ContextOS in the last five minutes; a configuration alone
is not a live connection. Confidence is explicitly supplied, not model-calibrated.

## Try the continuity flow

1. Open **Agents → Claude Code**, review its namespace permissions, and copy the generated configuration.
2. Merge it into the client's existing config and restart the client. Approve the local MCP server when prompted.
3. Ask the agent to use `remember` to record the goal, a sourced decision, and the next step.
4. Configure Codex or OpenCode against the same local database. Ask it to use `recall` before continuing.
5. Inspect the memories and their provenance in the workbench. To transfer manually, use **Handoffs** and download the Markdown.

Client configuration is generated with absolute paths for your machine. Existing
client files are never modified automatically. The MCP protocol and cross-agent
storage flow are integration-tested; full model-driven task completion across the
three third-party clients has not been benchmarked.

## Search

```text
type:semantic namespace:project
agent:claude tag:architecture
locked:true
path:context://project/ "SQLite"
action:updated "previous decision"
```

Filters and terms are ANDed, case-insensitively. Quotes group a phrase. Recognized
filters are `type`, `namespace`, `agent`, `action`, `locked`, `tag`, and `path`.
Use the Event log for old content. The UI and backend share the same parser.
Search is deterministic text matching, not vector similarity or arbitrary SQL.

## Use a client

```js
import { ContextOS } from './sdk/contextos.mjs';

const context = new ContextOS();
await context.remember({
  title: 'Local storage decision',
  content: 'Use SQLite with WAL mode for the local workspace.',
  type: 'semantic',
  namespace: 'project',
  source: 'Architecture discussion, 2026-09-07',
});
const memories = await context.recall('namespace:project SQLite');
```

```python
from sdk.contextos import ContextOS

context = ContextOS()
memories = context.recall("namespace:project SQLite")
```

The direct clients use the **trusted local owner API**. Agent runtimes should use
the scoped MCP tools or `context.tool(name, arguments, agent)` instead.
See [the protocol and adapter guide](docs/protocol.md) for schemas and configuration.

## Migrate a mem0 export

```sh
node scripts/migrate-mem0.mjs \
  --input /path/to/mem0-export.json \
  --output /path/to/contextos-archive.json
```

The converter accepts an array or `{ "results": [...] }` of records containing
`memory` text. Original fields, IDs, and metadata are retained in each memory's
content. It produces a ContextOS archive for **Settings → Import archive**, without
contacting mem0 or modifying a database. Files are not overwritten.

Converted memories default to the **user namespace, private visibility, and 50%
confidence pending review**. Use `--namespace project --share` only when you intend
to make them available to agents permitted to access that namespace. This migrates
exported snapshots; it cannot reconstruct history absent from the source export.

## Boundaries

This is a local owner application, not an authenticated multi-user server. It binds
to `127.0.0.1`, rejects non-local Host headers and cross-origin requests, uses
owner-only database permissions, and renders memory as untrusted text. Anyone
with access to your OS account can access its database and owner API.

Expired memories are excluded from agent retrieval but retained for inspection.
Deletion removes primary content, versions, history snapshots, links, and stored
handoff copies. It cannot recall downloaded exports, external backups, or data an
agent has already received. Archives and the database are **not application-encrypted**.

An import aborts on conflicting memory IDs, paths, invalid versions, or malformed
data. New workspaces adopt archive permissions. Existing explicit grants are
intersected with imported grants so an import does not widen access.

Not implemented: hosted/encrypted sync, enterprise identity/RBAC, a Rust daemon,
vector retrieval, automatic contradiction detection, timed background interventions,
physical secure erasure, managed retention/legal hold, or a long-horizon model
benchmark. The local MVP is a foundation for those extensions, not a claim of them.

## Built in the open

Read [CONTRIBUTING.md](CONTRIBUTING.md) to add a focused improvement or a community
adapter. [SECURITY.md](SECURITY.md) describes the local trust boundary. Commits are
pushed as working milestones, rather than one final code dump.

Related work: [OpenViking](https://github.com/volcengine/OpenViking),
[mem0](https://github.com/mem0ai/mem0), [Letta](https://github.com/letta-ai/letta),
[ai-memory](https://github.com/akitaonrails/ai-memory), and
[Hermes Agent](https://github.com/NousResearch/hermes-agent).
Research motivating the original brief:
[Remember When It Matters](https://arxiv.org/abs/2607.08716),
[PRO-LONG](https://arxiv.org/abs/2607.20064), and
[Agent Memory: Characterization and System Implications](https://arxiv.org/abs/2606.06448).
ContextOS does not claim to reproduce their experimental results.

## License

[MIT](LICENSE) for ContextOS. Vendored [Lucide](https://lucide.dev) icons retain their
[ISC and underlying Feather license notices](public/LUCIDE-LICENSE).

Typography uses the self-hosted [Outfit variable font](https://github.com/google/fonts/tree/main/ofl/outfit), distributed under the [SIL Open Font License](public/fonts/OFL.txt). No font requests leave your machine.
