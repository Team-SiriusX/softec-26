#!/bin/bash

# Build all services sequentially in the current terminal

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "Building all services from: $PROJECT_ROOT"
echo ""

ERROR_COUNT=0

run_build() {
  local label="$1"
  local dir="$2"
  local cmd="$3"

  echo "------------------------------------------------------------"
  echo "  [$label]"
  echo "  > $cmd"
  echo "------------------------------------------------------------"

  pushd "$PROJECT_ROOT/$dir" > /dev/null
  eval "$cmd"
  local exit_code=$?
  popd > /dev/null

  if [ $exit_code -ne 0 ]; then
    echo -e "  \033[31m[FAILED]\033[0m $label exited with code $exit_code"
    ERROR_COUNT=$((ERROR_COUNT + 1))
  else
    echo -e "  \033[32m[OK]\033[0m $label"
  fi
  echo ""
}

# Node.js services
run_build "grievance-service"  "grievance-service"  "pnpm run build"
run_build "root"               "."                  "pnpm run build"

# FastAPI services
run_build "ml-service"          "ml-service"          "uv pip install -r requirements.txt"
run_build "certificate-service" "certificate-service" "uv pip install -r requirements.txt"
run_build "anomaly-service"     "anomaly-service"     "uv pip install -r requirements.txt"

# Summary
echo "============================================================"
if [ $ERROR_COUNT -eq 0 ]; then
  echo -e "  \033[32mAll services built successfully.\033[0m"
else
  echo -e "  \033[31m$ERROR_COUNT service(s) failed. Check output above.\033[0m"
fi
echo "============================================================"
echo ""