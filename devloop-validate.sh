#!/usr/bin/env bash

# devloop-validate.sh
# Detect package manager and run available build/test/typecheck scripts.

set -euo pipefail

# Initialize result variables
echo "VALIDATION_START"

# Detect package manager
if [ -f "pnpm-lock.yaml" ]; then
  PACKAGE_MANAGER="pnpm"
elif [ -f "yarn.lock" ]; then
  PACKAGE_MANAGER="yarn"
elif [ -f "package-lock.json" ]; then
  PACKAGE_MANAGER="npm"
elif [ -f "package.json" ]; then
  PACKAGE_MANAGER="npm"
else
  PACKAGE_MANAGER="NOT_APPLICABLE"
fi

echo "PACKAGE_MANAGER=$PACKAGE_MANAGER"

# Function to check if a script exists in package.json
script_exists() {
  local name=$1
  if [ -f "package.json" ]; then
    # Grep for "<name>": pattern in scripts section
    if grep -q "\"$name\"[[:space:]]*:[[:space:]]*" package.json; then
      return 0
    fi
  fi
  return 1
}

# Run a script if it exists
run_script() {
  local name=$1
  local result_var=$2
  if script_exists "$name"; then
    case $PACKAGE_MANAGER in
      pnpm) CMD="pnpm run $name" ;;
      yarn) CMD="yarn $name" ;;
      npm) CMD="npm run $name" ;;
      *) CMD="" ;;
    esac
    if [ -n "$CMD" ]; then
      if $CMD; then
        echo "$result_var=PASS"
        return 0
      else
        echo "$result_var=FAIL"
        return 1
      fi
    else
      echo "$result_var=NOT_APPLICABLE"
      return 0
    fi
  else
    echo "$result_var=NOT_APPLICABLE"
    return 0
  fi
}

# Build
run_script "build" "BUILD"
BUILD_STATUS=$?
# Test
run_script "test" "TESTS"
TEST_STATUS=$?
# Typecheck (commonly called "typecheck" or "tsc")
if script_exists "typecheck"; then
  run_script "typecheck" "TYPECHECK"
  TYPECHECK_STATUS=$?
else
  # fallback to tsc if present
  if command -v tsc >/dev/null 2>&1; then
    if tsc; then
      echo "TYPECHECK=PASS"
      TYPECHECK_STATUS=0
    else
      echo "TYPECHECK=FAIL"
      TYPECHECK_STATUS=1
    fi
  else
    echo "TYPECHECK=NOT_APPLICABLE"
    TYPECHECK_STATUS=0
  fi
fi

# Determine overall result
if [ $BUILD_STATUS -ne 0 ] || [ $TEST_STATUS -ne 0 ] || [ $TYPECHECK_STATUS -ne 0 ]; then
  echo "VALIDATION_FAILED"
  exit 1
else
  echo "VALIDATION_PASSED"
  exit 0
fi
