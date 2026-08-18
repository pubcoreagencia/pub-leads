# DEVLOOP_CONTEXT_STANDARD

This specification defines the **standard continuity contract** for PUB DEV LOOP projects.

### Required Files
- `README_FOR_AGENTS.md`
- `MASTER_CONTEXT.md`
- `DEVLOOP_CONTEXT_STANDARD.md` (this file)
- `PROJECT_HANDOFF.md`
- `PROJECT_STATE.md`
- `.agent/CURRENT_STATE.md`
- `.agent/TASKS.md`
- `.agent/HANDOFF.md`
- `devloop-validate.sh`
- `devloop-checkpoint.sh`
- `devloop-resume.sh`

### Script Conventions
All `devloop:*` scripts must:
1. Detect which package manager is used (npm, pnpm, yarn) by looking for lockfiles.
2. If a corresponding script exists in the project's `package.json` (e.g., `npm run devloop:validate`), invoke it.
3. If no package manager is detected or the script is missing, output `NOT_APPLICABLE`.

Each script must exit with code 0 on success, non‑zero on failure.
