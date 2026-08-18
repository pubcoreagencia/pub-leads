# README_FOR_AGENTS

This repository provides a **generic continuity template** for PUB DEV LOOP projects. It defines the minimal set of documentation and scripts required to enable any project to be resumed, validated, and checkpointed solely from the Git repository.

## How to use
1. Clone this template into your project repository.
2. Rename the placeholder files (`PROJECT_HANDOFF.md`, `PROJECT_STATE.md`) to match your project's identifier.
3. Add the `devloop:*` scripts to your `package.json` or as separate executable files.
4. Run `npm run devloop:validate` (or the equivalent for your package manager) to ensure the project state is consistent.
5. Use `npm run devloop:checkpoint` after each meaningful change to record the state.
6. Use `npm run devloop:resume` on a fresh clone to reconstruct the last checkpoint.

The template is intentionally **runtime‑agnostic** – it contains no references to specific providers, Docker, or secrets.
