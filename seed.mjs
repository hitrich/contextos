// Fictional sample content. Only loaded with --demo into a new database.
export function seed(store) {
  if (store.setting('initialized') || store.list().length) return;
  const rows = [
    ['Project Atlas architecture', 'semantic', 'project', 'claude', 'Atlas is a local-first project management app. The web client uses TypeScript. Keep domain logic independent of the UI. Use SQLite locally and PostgreSQL for the hosted service.', ['architecture', 'atlas']],
    ['API authentication decisions', 'semantic', 'project', 'claude', 'Access tokens expire after 15 minutes. Refresh tokens rotate on use. Validate the token audience at every API boundary. Revisit the rotation policy before the next release.', ['security', 'api']],
    ['Prefer small, focused pull requests', 'semantic', 'user', 'codex', 'Keep each pull request centered on one user-visible outcome. Explain the behavior change and include the smallest meaningful check. Split unrelated cleanup into another change.', ['preferences', 'workflow']],
    ['Development environment setup', 'procedural', 'project', 'opencode', '1. Install Node.js 24.\n2. Copy .env.example to .env.local and supply local values.\n3. Run the database migrations.\n4. Start the development server.\n5. Run the smoke check before making changes.', ['onboarding', 'development']],
    ['Payment webhook investigation', 'episodic', 'project', 'claude', 'A duplicate payment webhook caused an invoice to be applied twice. We reproduced the issue with two identical event IDs. The agreed fix is a database uniqueness constraint on the external event ID.', ['debugging', 'payments']],
    ['Release readiness checklist', 'procedural', 'team', 'codex', 'Before releasing: verify migrations on a copy of the data, run the smoke check, review outstanding security changes, record a rollback point, and confirm the release owner is available.', ['release', 'checklist']],
    ['Design system decisions', 'semantic', 'project', 'claude', 'Use a warm neutral canvas and a restrained forest-green accent. Body text uses the system sans-serif stack. Keep focus states visible. A color alone must never communicate a status.', ['design', 'accessibility']],
    ['Database migration playbook', 'procedural', 'project', 'codex', 'Write additive migrations first. Backfill existing rows in bounded batches. Deploy readers that understand both shapes, then remove the old column in a later release. Verify the rollback path.', ['database', 'migration']],
    ['API rate limits', 'semantic', 'project', 'opencode', 'Rate limits are scoped to the account, not the access token. Return Retry-After on a 429 response. Client retries must respect this header and include jitter.', ['api', 'reliability']],
    ['Sprint planning · September', 'episodic', 'team', 'claude', 'The team prioritized cross-agent continuity, the memory inspector, and import/export. Hosted sync is deferred until the local storage and protocol are stable.', ['planning', 'team']],
    ['Authentication refactor completed', 'episodic', 'project', 'codex', 'Moved token validation into a shared boundary. All API routes now use the same audience and expiry checks. The regression check covers an expired token and a wrong audience.', ['security', 'milestone']],
    ['Naming conventions', 'semantic', 'team', 'opencode', 'Use meaningful nouns for stored objects and verbs for actions. Avoid abbreviations in public APIs. Database identifiers use snake_case and JavaScript variables use camelCase.', ['conventions', 'team']],
    ['Communication preferences', 'semantic', 'user', 'claude', 'Start with the outcome. Use short paragraphs and concrete examples. Call out uncertainty where it affects a decision. Preserve context when switching between coding agents.', ['preferences', 'communication']],
    ['Deployment rollback procedure', 'procedural', 'team', 'codex', 'Pause new deployments, select the last healthy release, verify schema compatibility, restore the application version, and observe error rate and queue depth before closing the incident.', ['operations', 'deployment']],
    ['Onboarding flow observations', 'episodic', 'project', 'claude', 'In the sample walkthrough, the user found the first memory through search but missed the namespace selector. Keep the active namespace near the page title and preserve it between views.', ['research', 'onboarding']],
    ['Keep tests close to source files', 'semantic', 'user', 'codex', 'Prefer checks that exercise observable behavior. Reuse the existing runner. Do not add a testing framework for a small assertion-based check.', ['preferences', 'testing']],
    ['Search indexing strategy', 'semantic', 'project', 'opencode', 'Start with deterministic paths and exact filters. Search the full event history when a belief has changed. Add semantic retrieval only after exact retrieval has a measured gap.', ['search', 'architecture']],
    ['Incident review: queue backlog', 'episodic', 'team', 'claude', 'The queue backlog grew while the downstream API was unavailable. We reduced concurrency and allowed the queue to drain. Follow-up: bound retries and alert on the age of the oldest pending job.', ['incident', 'operations']],
    ['Accessibility is a release requirement', 'semantic', 'team', 'codex', 'Every core task must work with a keyboard. Dialogs need a title, initial focus, an Escape path, and focus restoration. Verify layout at narrow widths before release.', ['accessibility', 'quality']],
    ['Caching policy for user profiles', 'semantic', 'project', 'opencode', 'Profile responses are private. Use short-lived per-user caches and invalidate them on edits. Never place authenticated profile responses in a shared public cache.', ['privacy', 'performance']],
    ['Weekly dependency review', 'procedural', 'team', 'claude', 'Review direct dependency advisories, read the release notes for proposed updates, update the lockfile, and run the existing checks. Record any intentionally deferred update with its reason.', ['maintenance', 'security']],
    ['Cross-agent handoff protocol', 'semantic', 'project', 'codex', 'A useful handoff includes the current goal, decisions already made, constraints, relevant source paths, and the next concrete action. Carry provenance with every retained memory.', ['handoff', 'agents']],
    ['Session summary: dashboard polish', 'episodic', 'project', 'claude', 'Completed the memory overview layout and clarified the distinction between configured and connected agents. Next: exercise memory editing, verify keyboard navigation, and check the narrow layout.', ['session', 'dashboard']],
    ['Timezone and working hours', 'semantic', 'user', 'opencode', 'The sample workspace uses Europe/Istanbul. Store timestamps in UTC and render them in the local timezone. Schedule reviews during working hours unless the user requests otherwise.', ['preferences', 'time']],
  ];
  const ids = [];
  rows.forEach(([title, type, namespace, agent, content, tags], i) => {
    const memory = store.save({ title, type, namespace, content, tags, source: `Sample ${agent} session · ${tags[0]}`, confidence: [98, 96, 100, 92, 88, 95, 97, 99][i % 8], due_at: i === 1 ? new Date(Date.now() - 3600000).toISOString() : null, visibility: namespace === 'user' ? 'private' : 'agents', related: i > 0 && namespace === 'project' ? [ids[0]] : [] }, { ...store.actor(), id: agent });
    ids.push(memory.id);
    const createdAt = new Date(Date.now() - (6 - Math.floor(i / 4)) * 86400000 - (4 - i % 4) * 3600000).toISOString();
    memory.created_at = createdAt; memory.updated_at = createdAt;
    store.db.prepare('UPDATE memories SET data=? WHERE id=?').run(JSON.stringify(memory), memory.id);
    store.db.prepare('UPDATE versions SET data=? WHERE memory_id=?').run(JSON.stringify(memory), memory.id);
    const event = store.db.prepare('SELECT id,data FROM events WHERE memory_id=?').get(memory.id);
    const entry = JSON.parse(event.data); entry.timestamp = createdAt; entry.snapshot = memory;
    store.db.prepare('UPDATE events SET data=? WHERE id=?').run(JSON.stringify(entry), event.id);
  });
  store.setSetting('sample', true);
  store.setSetting('initialized', true);
  store.setSetting('workspace', { name: 'Personal workspace', reminders: true });
}
