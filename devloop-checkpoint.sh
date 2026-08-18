#!/usr/bin/env bash

# devloop-checkpoint.sh
# Create a portable checkpoint JSON with repository and environment state.

set -euo pipefail

# Helper to detect package manager (same logic as validate script)
detect_pm() {
  if [ -f "pnpm-lock.yaml" ]; then
    echo "pnpm"
  elif [ -f "yarn.lock" ]; then
    echo "yarn"
  elif [ -f "package-lock.json" ]; then
    echo "npm"
  elif [ -f "package.json" ]; then
    echo "npm"
  else
    echo "NOT_APPLICABLE"
  fi
}

PACKAGE_MANAGER=$(detect_pm)

# Gather git info
REPO_URL=$(git config --get remote.origin.url || echo "UNKNOWN")
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
CURRENT_COMMIT=$(git rev-parse HEAD)
WORKING_STATUS=$(git status --porcelain || echo "")
CHANGED_FILES=$(git diff --name-only || echo "")
REMOTE_STATUS=$(git remote show origin || echo "")

# Run validation to capture statuses (ignore failures for checkpoint purposes)
VALIDATION_OUTPUT=$(./devloop-validate.sh 2>/dev/null || true)
# Extract individual statuses from validation output
BUILD_STATUS=$(echo "$VALIDATION_OUTPUT" | grep '^BUILD=' | cut -d'=' -f2 || echo "NOT_APPLICABLE")
TESTS_STATUS=$(echo "$VALIDATION_OUTPUT" | grep '^TESTS=' | cut -d'=' -f2 || echo "NOT_APPLICABLE")
TYPECHECK_STATUS=$(echo "$VALIDATION_OUTPUT" | grep '^TYPECHECK=' | cut -d'=' -f2 || echo "NOT_APPLICABLE")
VALIDATION_STATUS=$(echo "$VALIDATION_OUTPUT" | grep -E 'VALIDATION_PASSED|VALIDATION_FAILED' | head -n1 || echo "UNKNOWN")

# Required canonical files existence
file_exists() { [ -f "$1" ] && echo "YES" || echo "NO"; }

README_EXISTS=$(file_exists "README_FOR_AGENTS.md")
MASTER_EXISTS=$(file_exists "MASTER_CONTEXT.md")
DEVLOOP_EXISTS=$(file_exists "DEVLOOP_CONTEXT_STANDARD.md")
HANDOFF_EXISTS=$(file_exists "PROJECT_HANDOFF.md")
STATE_EXISTS=$(file_exists "PROJECT_STATE.md")
CURRENT_STATE_EXISTS=$(file_exists ".agent/CURRENT_STATE.md")
TASKS_EXISTS=$(file_exists ".agent/TASKS.md")
HANDOFF_AGENT_EXISTS=$(file_exists ".agent/HANDOFF.md")

# Build JSON (portable, no secrets)
cat <<EOF > .agent/CHECKPOINT.json
{
  "timestamp": "$(date -u +'%%Y-%%m-%%dT%%H:%%M:%%SZ')",
  "repository": "$REPO_URL",
  "current_branch": "$CURRENT_BRANCH",
  "current_commit": "$CURRENT_COMMIT",
  "working_tree_status": "$(echo "$WORKING_STATUS" | sed 's/"/\\"/g')",
  "changed_files": "$(echo "$CHANGED_FILES" | tr '\n' ';' | sed 's/"/\\"/g')",
  "remote_status": "$(echo "$REMOTE_STATUS" | sed 's/"/\\"/g')",
  "package_manager": "$PACKAGE_MANAGER",
  "build_status": "$BUILD_STATUS",
  "test_status": "$TESTS_STATUS",
  "typecheck_status": "$TYPECHECK_STATUS",
  "validation_status": "$VALIDATION_STATUS",
  "canonical_files": {
    "README_FOR_AGENTS.md": "$README_EXISTS",
    "MASTER_CONTEXT.md": "$MASTER_EXISTS",
    "DEVLOOP_CONTEXT_STANDARD.md": "$DEVLOOP_EXISTS",
    "PROJECT_HANDOFF.md": "$HANDOFF_EXISTS",
    "PROJECT_STATE.md": "$STATE_EXISTS",
    ".agent/CURRENT_STATE.md": "$CURRENT_STATE_EXISTS",
    ".agent/TASKS.md": "$TASKS_EXISTS",
    ".agent/HANDOFF.md": "$HANDOFF_AGENT_EXISTS"
  }
}
EOF

echo "CHECKPOINT_CREATED"
exit 0
