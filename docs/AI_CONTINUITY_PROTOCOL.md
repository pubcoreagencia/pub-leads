# AI Continuity Protocol

The repository is the durable source of truth for project evolution. Conversation history, local workspaces, accounts, machines, and specific AI sessions are temporary.

Any meaningful evolution — code, architecture, decisions, fixes, discoveries, blockers, or operational state — must be materialized in Git.

Required lifecycle: read repository context → implement → validate → update context/status/handoff → commit → push or PR → leave a clear handoff if incomplete.

A task is not durably complete merely because it worked inside an AI session or local workspace. Another AI or developer must be able to clone the repository and continue without relying on the conversation that produced the change.
