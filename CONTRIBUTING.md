# Contributing to CodeMachine

## Ways to Contribute

- **Bug fixes:** Help us squash bugs and improve stability.
- **Workflows:** Add new workflow templates for different use cases.
- **AI Providers & Engines:** Integrate new AI engines and providers.
- **Environment-specific fixes:** Fix platform or OS-specific quirks.
- **Documentation:** Improve guides, examples, and API docs.

> **UI and Features:** Must ask for team review first. If you're unsure your PR will be accepted, ask the core dev team first. Otherwise, your PR will likely be refused.

## Development

**Requirements:** Bun 1.3+

Install dependencies and start the dev server:

```bash
bun install
bun dev
```

## Codebase

| Directory | Purpose |
|-----------|---------|
| `src/infra/` | Core infrastructure - logging, file ops, process management |
| `src/cli/tui/` | Terminal UI - screens, components, state |
| `src/workflows/` | Workflow engine - execution, templates, resolvers |
| `src/agents/` | Agent system - runner, config, discovery |
| `src/shared/` | Shared utilities - types, helpers, constants |
| `config/` | Agent and module definitions |
| `prompts/` | Prompt templates for agents |
| `templates/` | Workflow templates |

## Pull Requests

Run these before submitting:

```bash
bun run lint
bun run typecheck
bun test
```

Keep PRs focused - one feature or fix per PR.

## Style

- **Files:** One file, one purpose. Keep files focused and small.
- **Runtime:** Use Bun APIs (`Bun.file()`, `Bun.spawn()`) when they fit the use case.
- **Variables:** Prefer `const`. Avoid `any` types.
- **Control flow:** Early returns over nested conditions.

## Feature Requests

Open an issue describing the feature and wait for approval before starting work.
