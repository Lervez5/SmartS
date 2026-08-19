# SmartSprout Engineering Workflow

## Repository Hardening Overview

Stage One hardening establishes local engineering guardrails across the SmartSprout monorepo. All controls are enforced locally through Git hooks, lint-staged, and root-level scripts.

## Dependency Installation

```bash
pnpm install
```

- Uses pnpm workspace with the version pinned in root `package.json` (`packageManager` field).
- Husky hooks are installed automatically via the `prepare` script.
- Lockfile (`pnpm-lock.yaml`) must be committed. Use `--frozen-lockfile` in CI.

## Git Hooks

Hooks are defined in `.husky/` and installed automatically by `pnpm install` (via `prepare`).

| Hook         | Purpose                                                     |
| :----------- | :---------------------------------------------------------- |
| `commit-msg` | Runs Commitlint against the commit message.                 |
| `pre-commit` | Runs lint-staged on staged files.                           |
| `pre-push`   | Runs TypeScript type-check and lint for backend + frontend. |

To manually reinstall hooks after cloning:

```bash
pnpm run prepare
```

## Conventional Commits

All commit messages must follow the Conventional Commits specification:

```bash
<type>(<scope>): <subject>
```

### Supported Types

| Type       | Purpose                                                 |
| :--------- | :------------------------------------------------------ |
| `feat`     | New feature                                             |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation only                                      |
| `style`    | Code style (formatting, missing semicolons, etc.)       |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                 |
| `test`     | Adding or updating tests                                |
| `build`    | Build system or external dependencies                   |
| `ci`       | CI configuration or scripts                             |
| `chore`    | Maintenance tasks, dependencies, etc.                   |
| `revert`   | Reverts a previous commit                               |
| `security` | Security-related changes                                |

### Rules

- Type must be lowercase.
- Subject must not be empty.
- Subject must not end with a period.
- Header must be 100 characters or less.

### Examples

```bash
feat(backend): add assignment submission endpoint
fix(frontend): resolve calendar pagination bug
docs: update deployment guide
chore(deps): upgrade express to 4.21.0
security: rotate exposed JWT secret
```

## Staged File Processing (lint-staged)

lint-staged runs only on files staged for commit. Configuration is in `lint-staged.config.js`.

| Pattern             | Command                             |
| :------------------ | :---------------------------------- |
| `*`                 | `prettier --ignore-unknown --cache` |
| `*.{js,jsx,ts,tsx}` | `eslint --fix --cache`              |
| `*.{json,yaml,yml}` | `prettier --write`                  |
| `*.md`              | `prettier --write`                  |

This ensures consistent formatting and catches lint errors before they enter the repository.

## Linting

### Backend

```bash
pnpm --filter @smartsprout/backend lint
```

Uses ESLint flat config (`backend/eslint.config.js`) with TypeScript support.

### Frontend

```bash
pnpm --filter @smartsprout/frontend-kids lint
```

Uses Next.js ESLint configuration (`frontend-kids/eslint.config.mjs`) with core-web-vitals and TypeScript rules.

### Python (AI Engine)

```bash
pnpm run python:lint
```

Uses Ruff to lint the `ai_engine/app` directory.

## Formatting

### Check formatting

```bash
pnpm run format:check
```

### Auto-format

```bash
pnpm run format
```

Prettier configuration is in `.prettierrc`. Files and directories excluded from formatting are listed in `.prettierignore`.

## Type Checking

### Backend

```bash
pnpm --filter @smartsprout/backend typecheck
```

Runs `tsc -p tsconfig.json --noEmit`.

### Frontend

```bash
pnpm --filter @smartsprout/frontend-kids typecheck
```

Runs `tsc --noEmit` via the Next.js TypeScript setup.

### Python

No mypy configuration is currently established. If type checking is needed, it should be added in a follow-up.

## Security Checks

### Secret Scanning

```bash
pnpm run secrets:check
```

Runs a lightweight regex-based scanner over the repository to detect accidentally committed secrets. This is not a substitute for proper secret management but acts as a safety net.

### Dependency Auditing

```bash
pnpm run deps:audit
```

Runs `pnpm audit --audit-level high` to identify known vulnerabilities in JavaScript/TypeScript dependencies.

## Root Verification Workflow

Run all local engineering checks:

```bash
pnpm run verify
```

This executes:

1. Prettier format check
2. ESLint for backend + frontend + Python lint
3. TypeScript type-check for backend + frontend
4. Secret scanning
5. Dependency audit

If any check fails, the command exits with a non-zero status.

## Workspace Structure

```
.
├── backend/              # Express + Prisma + TypeScript
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   └── tsconfig.json
├── frontend-kids/        # Next.js + React + TypeScript
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── ai_engine/            # FastAPI + Python
│   ├── app/
│   ├── .venv/            # Local virtualenv (ignored)
│   └── requirements.txt
├── docs/
│   └── engineering/      # Engineering documentation
├── package.json          # Root workspace config + scripts
├── pnpm-workspace.yaml   # pnpm workspace packages
├── commitlint.config.cjs # Commitlint configuration
├── lint-staged.config.js # lint-staged configuration
├── .prettierrc           # Prettier configuration
├── .prettierignore       # Prettier ignore rules
└── .husky/               # Git hooks
```

## Python Virtual Environment

The `ai_engine/.venv` directory is local to each developer machine and is excluded from version control. If you need to recreate it:

```bash
cd ai_engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install ruff
```

## Troubleshooting

### Husky hooks not running

Ensure `pnpm install` completed successfully and the `prepare` script ran. You can manually re-run:

```bash
pnpm run prepare
```

### Pre-commit hook failing on unrelated files

lint-staged only processes staged files. If you see unrelated errors, check that you have not accidentally staged build artifacts or generated files.

### Commitlint rejecting valid messages

Check the configured types in `commitlint.config.cjs`. If you need to add a new type, update the `type-enum` rule and document it here.
