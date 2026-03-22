#!/usr/bin/env bash
set -euo pipefail

if [ ! -f frontend/.env ]; then
  echo "❌ frontend/.env not found. Run scripts/deploy.sh first."
  exit 1
fi

source frontend/.env
CONTRACT_ID=$VITE_CONTRACT_ID
DEPLOYER=$(stellar keys address deployer)

echo "▶ Contract: $CONTRACT_ID"
echo "▶ Deployer: $DEPLOYER"

echo "\n1️⃣  Adding first todo..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- add_todo \
  --owner "$DEPLOYER" \
  --text "Buy groceries"

echo "\n2️⃣  Adding second todo..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- add_todo \
  --owner "$DEPLOYER" \
  --text "Ship the dApp"

echo "\n3️⃣  Getting all todos..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- get_todos \
  --owner "$DEPLOYER"

echo "\n4️⃣  Toggling first todo (ID 0)..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- toggle_todo \
  --owner "$DEPLOYER" \
  --todo_id 0

echo "\n5️⃣  Clearing completed..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- clear_completed \
  --owner "$DEPLOYER"

echo "\n6️⃣  Verifying final state..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account deployer \
  -- get_todos \
  --owner "$DEPLOYER"

echo "\n✅ All smoke tests passed"
