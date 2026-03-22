#!/usr/bin/env bash
set -euo pipefail

echo "▶ Checking for deployer identity..."
if ! stellar keys address deployer &>/dev/null; then
  echo "Generating new deployer key..."
  stellar keys generate deployer --network testnet
fi

DEPLOYER=$(stellar keys address deployer)
echo "▶ Deployer: $DEPLOYER"

echo "▶ Funding via Friendbot..."
RESPONSE=$(curl -sf "https://friendbot.stellar.org?addr=$DEPLOYER")
echo "✅ Funded: $DEPLOYER"
echo "$RESPONSE" | grep -o '"hash":"[^"]*"' | head -1 || true
