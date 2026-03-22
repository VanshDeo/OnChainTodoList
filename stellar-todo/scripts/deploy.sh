#!/usr/bin/env bash
set -euo pipefail

echo "════════════════════════════════════"
echo "  stellar-todo — Deploy to Testnet"
echo "════════════════════════════════════"

# Build contract WASM
echo "▶ Step 1: Building contract WASM..."
cd contract
cargo build --target wasm32-unknown-unknown --release
cd ..

WASM_PATH="contract/target/wasm32-unknown-unknown/release/stellar_todo.wasm"

# Optimize WASM binary
echo "▶ Step 2: Optimizing WASM binary..."
stellar contract optimize --wasm "$WASM_PATH"
OPTIMIZED_WASM="${WASM_PATH%.wasm}.optimized.wasm"

echo "   Original:  $(du -sh "$WASM_PATH" | cut -f1)"
echo "   Optimized: $(du -sh "$OPTIMIZED_WASM" | cut -f1)"

# Deploy to Stellar Testnet
echo "▶ Step 3: Deploying to Stellar Testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$OPTIMIZED_WASM" \
  --network testnet \
  --source deployer)

echo "✅ Contract deployed!"
echo "   CONTRACT_ID: $CONTRACT_ID"

# Write contract address to frontend/.env
echo "▶ Step 4: Writing contract address to frontend/.env..."
mkdir -p frontend
cat > frontend/.env <<EOF
VITE_CONTRACT_ID=$CONTRACT_ID
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
EOF

echo "✅ frontend/.env written:"
cat frontend/.env

echo "════════════════════════════════════"
echo "  PHASE A COMPLETE — Start Phase B"
echo "════════════════════════════════════"
