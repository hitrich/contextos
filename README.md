# ContextOS

A portable, inspectable home for agent memory. Local-first, vendor-neutral, and MIT licensed.

ContextOS is being built in public as a working local MVP: structured memories,
version history, provenance, full-history search, a memory workbench, and portable
handoffs between Claude Code, Codex, and OpenCode.

The local implementation uses Node.js 24's built-in SQLite and HTTP modules, with
no runtime dependencies. A Rust daemon and hosted sync are future extensions,
not requirements for owning and inspecting your memory today.

## Development

Requires Node.js 24 or newer. The storage foundation, workbench, and agent bridge
are landing as separate, runnable milestones. Local databases, environment files,
and private memory exports must not be committed.

## License

[MIT](LICENSE). Contributions and community adapters are welcome.
