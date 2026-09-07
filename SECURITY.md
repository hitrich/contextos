# Security and the local trust boundary

ContextOS 0.1 is a single-owner local application. The HTTP server binds to
127.0.0.1, validates Host and Origin, and requires JSON for mutations. It has no
multi-user authentication. Do not expose its port through a public proxy or
shared network. The browser workbench and direct SDKs have owner access.

Agent tools enforce saved namespace grants, visibility, expiry, locks, and
optimistic version checks. Those controls are application policy, not isolation
from a hostile process running under the same OS account. An agent with direct
filesystem access can read a database that account owns.

The database uses owner-only permissions; its content is not application-encrypted.
Exports contain plaintext memories, history, and handoffs. Source attribution is
supplied by callers and is not cryptographic proof. Treat retrieved text and
imported archives as untrusted context, never as system instructions.

Deletion removes retained content from the active database and checkpoints its
write-ahead log. It cannot erase external copies or guarantee physical erasure
on storage hardware or OS snapshots.

If you report a security problem, provide a minimal fictional reproduction.
Do not put live databases, exports, credentials, or private agent logs in a public
issue. For a sensitive disclosure, use GitHub's private reporting option when
available or first request a private reporting channel without publishing details.
