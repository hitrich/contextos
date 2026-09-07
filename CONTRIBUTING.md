# Contributing to ContextOS

Use Node.js 24+ and Python 3.10+. There are no packages to install. Run `npm test`,
then `npm run demo` to explore a fictional workspace at localhost:3000. Use a
separate `CONTEXTOS_DB` when experimenting with imports or deletion.

Keep a change centered on a concrete user outcome. Follow the existing native
module/CSS patterns and the shared store instead of adding a parallel policy
layer. Bug fixes should cover every caller through the shared function. Include
one focused runnable regression check for changed logic.

For UI work, exercise the relevant flow with a keyboard and at a narrow width.
Keep memory content escaped, labels visible, focus inside dialogs, and failures
recoverable. Do not add network calls, telemetry, or hosted services by default.

Never commit `.contextos`, live memory archives, `.env` files, tokens, or a user's
agent configuration. Use fictional fixtures in tests and examples. Preserve the
Lucide license notices when changing icon assets.

Open a focused pull request describing the behavior change and the checks you
ran. For a community adapter, see [the protocol guide](docs/protocol.md). Large
hosted features or changes to archive compatibility should begin with an issue
describing the concrete requirement and migration behavior.
