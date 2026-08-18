#!/usr/bin/env bash

# devloop-resume.sh
# Reconstruct operational context from .agent/CHECKPOINT.json without modifying the project.

set -euo pipefail

CHECKPOINT_FILE=".agent/CHECKPOINT.json"

if [ ! -f "$CHECKPOINT_FILE" ]; then
  echo "RESUME_FAILED: checkpoint file not found"
  exit 1
fi

# Read checkpoint JSON using jq if available, otherwise fallback to grep/awk (portable)
if command -v jq >/dev/null 2>&1; then
  REPO=$(jq -r '.repository' "$CHECKPOINT_FILE")
  BRANCH=$(jq -r '.current_branch' "$CHECKPOINT_FILE")
  COMMIT=$(jq -r '.current_commit' "$CHECKPOINT_FILE")
  WORKING_STATUS=$(jq -r '.working_tree_status' "$CHECKPOINT_FILE")
  VALIDATION_STATUS=$(jq -r '.validation_status' "$CHECKPOINT_FILE")
  BUILD_STATUS=$(jq -r '.build_status' "$CHECKPOINT_FILE")
  TEST_STATUS=$(jq -r '.test_status' "$CHECKPOINT_FILE")
  TYPECHECK_STATUS=$(jq -r '.typecheck_status' "$CHECKPOINT_FILE")
else
  # Very basic extraction without jq (assumes simple JSON format)
  REPO=$(grep '"repository"' "$CHECKPOINT_FILE" | sed -E 's/.*"repository": "([^"]+)".*/\1/')
  BRANCH=$(grep '"current_branch"' "$CHECKPOINT_FILE" | sed -E 's/.*"current_branch": "([^"]+)".*/\1/')
  COMMIT=$(grep '"current_commit"' "$CHECKPOINT_FILE" | sed -E 's/.*"current_commit": "([^"]+)".*/\1/')
  WORKING_STATUS=$(grep '"working_tree_status"' "$CHECKPOINT_FILE" | sed -E 's/.*"working_tree_status": "([^"]+)".*/\1/')
  VALIDATION_STATUS=$(grep '"validation_status"' "$CHECKPOINT_FILE" | sed -E 's/.*"validation_status": "([^"]+)".*/\1/')
  BUILD_STATUS=$(grep '"build_status"' "$CHECKPOINT_FILE" | sed -E 's/.*"build_status": "([^"]+)".*/\1/')
  TEST_STATUS=$(grep '"test_status"' "$CHECKPOINT_FILE" | sed -E 's/.*"test_status": "([^"]+)".*/\1/')
  TYPECHECK_STATUS=$(grep '"typecheck_status"' "$CHECKPOINT_FILE" | sed -E 's/.*"typecheck_status": "([^"]+)".*/\1/')
fi

# Output the recorded information
cat <<EOS
Repository: $REPO
Branch: $BRANCH
Commit: $COMMIT
Validation status: $VALIDATION_STATUS
Build status: $BUILD_STATUS
Test status: $TEST_STATUS
Typecheck status: $TYPECHECK_STATUS
Working tree status (from checkpoint):
$WORKING_STATUS
EOS

# Compare current git status with checkpointed status (non‑destructive)
CURRENT_STATUS=$(git status --porcelain || echo "")
if [ "$CURRENT_STATUS" = "$WORKING_STATUS" ]; then
  echo "RESUME_PASSED"
  exit 0
else
  echo "RESUME_FAILED: current working tree differs from checkpoint"
  exit 1
fi
