#!/usr/bin/env bash
# Fresh-clone verification wrapper (Unix). Delegates to the Node runner.
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/verify-fresh-clone.mjs
