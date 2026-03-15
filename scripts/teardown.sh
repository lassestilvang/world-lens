#!/bin/bash
set -euo pipefail

# ─── WorldLens Teardown Script ─────────────────────────────────────────
# Removes all AWS resources provisioned by CDK.
#
# Usage: ./scripts/teardown.sh
# ───────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infrastructure"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  WorldLens — Teardown"
echo "════════════════════════════════════════════════════════════"
echo ""

if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured."
    exit 1
fi

cd "$INFRA_DIR"

if [ ! -d "node_modules" ]; then
    npm ci --silent
fi

echo "🗑️  Destroying CDK stack..."
npx cdk destroy --force

# Clean up local files
rm -f cdk-outputs.json
rm -f "$SCRIPT_DIR/../.env.local"

echo ""
echo "  ✅ All AWS resources removed."
echo "  ✅ Local .env.local cleaned up."
echo ""
