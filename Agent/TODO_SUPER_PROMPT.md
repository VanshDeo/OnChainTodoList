# 🚀 SUPER PROMPT — Web3 Todo dApp on Stellar Soroban
### Optimized for Antigravity Agentic Workflow

---

## 🤖 ANTIGRAVITY AGENT INSTRUCTIONS

You are a full-stack Web3 engineer agent. Execute this project in **two strict sequential phases**:

**PHASE A — Smart Contract**
Build → Test → Deploy → Write CONTRACT_ID to `frontend/.env`

**PHASE B — Frontend**
Only begin after Phase A gate is confirmed: `frontend/.env` exists with a valid `VITE_CONTRACT_ID=C...`

Execute real terminal commands at every step. Do not simulate output. Do not move to Phase B until the contract is live on Stellar Testnet and the contract address is persisted to the environment file.

---

## 📐 PROJECT OVERVIEW

| Field | Value |
|---|---|
| **Project Name** | `stellar-todo` |
| **Type** | Web3 Todo dApp (Full-Stack) |
| **Blockchain** | Stellar Soroban Testnet |
| **Contract Language** | Rust + Soroban SDK |
| **Frontend** | React 18 + TypeScript + Vite |
| **Wallet** | Freighter Browser Extension |
| **Storage Strategy** | Per-wallet todo list — optimized with instance storage for counters, persistent storage for todos |

---

## 🗂 EXACT PROJECT STRUCTURE

Generate this folder layout exactly — no deviations:

```
stellar-todo/
├── contract/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   └── src/
│       └── lib.rs                        # Full contract + all unit tests
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── .env                              # Written by deploy.sh — NEVER commit
│   ├── .env.example
│   └── src/
│       ├── main.tsx                      # Entry point + ErrorBoundary
│       ├── App.tsx                       # Root layout + context provider
│       ├── types/
│       │   └── index.ts                  # All TypeScript interfaces + enums
│       ├── lib/
│       │   ├── contract.ts               # All Soroban contract interactions
│       │   └── wallet.ts                 # Freighter wallet utilities
│       ├── hooks/
│       │   ├── useWallet.ts              # Wallet state + connect/disconnect
│       │   └── useTodos.ts               # Todo CRUD state + actions
│       ├── context/
│       │   └── WalletContext.tsx         # Global wallet context + provider
│       └── components/
│           ├── ConnectWallet.tsx         # Wallet button + network guard
│           ├── TodoInput.tsx             # New todo text input + add button
│           ├── TodoItem.tsx              # Single todo row with actions
│           ├── TodoList.tsx              # List renderer + empty state
│           └── TxStatusBar.tsx           # Transaction lifecycle status strip
│
├── scripts/
│   ├── deploy.sh                         # Build → optimize → deploy → write .env
│   ├── fund-account.sh                   # Fund deployer via Friendbot
│   └── invoke-test.sh                    # CLI smoke tests for all functions
│
├── .env.example                          # Root-level placeholder
├── .gitignore
└── README.md
```

---

# ══════════════════════════════════════════════
# PHASE A — SMART CONTRACT
# Do NOT touch the frontend until this phase is 100% complete
# ══════════════════════════════════════════════

## STEP A-1: Initialize Rust Project

Run exactly:
```bash
mkdir -p stellar-todo/contract/src stellar-todo/scripts
cd stellar-todo
git init
```

---

## STEP A-2: `contract/Cargo.toml`

```toml
[package]
name = "stellar-todo"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = { version = "20.0.0", features = ["alloc"] }

[dev-dependencies]
soroban-sdk = { version = "20.0.0", features = ["testutils"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
```

---

## STEP A-3: `contract/src/lib.rs` — Full Contract Implementation

Write the **complete, production-ready** contract. Every function fully implemented. No TODOs. No stubs.

### Storage Optimization Strategy

> **Key design principle: minimize ledger storage entries.**
>
> Instead of one storage key per todo item, store the entire todo list for a wallet as a single `Vec<Todo>` under one key. This means one read/write per operation instead of N keys — dramatically cheaper in ledger fees and TTL rent costs.

```rust
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Vec,
};
```

### Data Structures

```rust
// ── Todo item ────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Todo {
    pub id: u32,               // Monotonically increasing ID per wallet
    pub text: String,          // The todo content — max 256 chars
    pub completed: bool,       // Completion toggle state
    pub created_at: u64,       // Ledger timestamp at creation
    pub updated_at: u64,       // Ledger timestamp of last modification
}

// ── Storage keys ─────────────────────────────────────────────────
// OPTIMIZATION: Two keys per wallet:
//   TodoList  → stores the entire Vec<Todo> in one entry (NOT one key per todo)
//   TodoCount → stores the ID counter as a u32 (instance storage for cheaper access)
#[contracttype]
pub enum DataKey {
    TodoList(Address),    // Persistent storage — entire todo list as Vec<Todo>
    TodoCount(Address),   // Instance storage — monotonic ID counter
}

// ── Contract errors ──────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
pub enum TodoError {
    TodoNotFound      = 1,
    TextTooLong       = 2,
    EmptyText         = 3,
    AlreadyCompleted  = 4,
    AlreadyIncomplete = 5,
    ListEmpty         = 6,
}
```

### Contract Implementation — ALL Functions Fully Implemented

```rust
#[contract]
pub struct TodoContract;

#[contractimpl]
impl TodoContract {

    // ── ADD TODO ──────────────────────────────────────────────────────────────
    // owner: the wallet creating the todo — must authorize
    // text: the todo text — must be 1–256 chars
    // Returns the new todo's ID
    //
    // Implementation:
    // 1. owner.require_auth()
    // 2. Validate text: len == 0 → EmptyText; len > 256 → TextTooLong
    // 3. Read TodoCount(owner) from INSTANCE storage (default 0)
    // 4. Use count as new todo ID, increment count, save back to instance storage
    // 5. Read TodoList(owner) from PERSISTENT storage (default empty Vec)
    // 6. Push new Todo { id, text, completed: false, created_at, updated_at } to Vec
    // 7. Save updated Vec back to PERSISTENT storage
    // 8. Return new todo ID
    pub fn add_todo(env: Env, owner: Address, text: String) -> u32 {
        owner.require_auth();

        let text_len = text.len();
        if text_len == 0 {
            panic!("todo text cannot be empty");
        }
        if text_len > 256 {
            panic!("todo text exceeds 256 character limit");
        }

        // ID counter — use instance storage (cheaper, ephemeral is fine for counter)
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TodoCount(owner.clone()))
            .unwrap_or(0);
        let new_id = count;
        env.storage()
            .instance()
            .set(&DataKey::TodoCount(owner.clone()), &(count + 1));

        // Load entire todo list — one storage read
        let mut todos: Vec<Todo> = env
            .storage()
            .persistent()
            .get(&DataKey::TodoList(owner.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        let now = env.ledger().timestamp();
        let todo = Todo {
            id: new_id,
            text,
            completed: false,
            created_at: now,
            updated_at: now,
        };

        todos.push_back(todo);

        // One storage write for the entire list
        env.storage()
            .persistent()
            .set(&DataKey::TodoList(owner.clone()), &todos);

        new_id
    }

    // ── TOGGLE COMPLETE ───────────────────────────────────────────────────────
    // Flips the completed state of a todo.
    // If completed → sets to false. If incomplete → sets to true.
    // owner: must authorize
    // todo_id: the ID of the todo to toggle
    //
    // Implementation:
    // 1. owner.require_auth()
    // 2. Load TodoList(owner) — panic ListEmpty if empty
    // 3. Find todo by ID — panic TodoNotFound if not present
    // 4. Flip completed boolean, update updated_at
    // 5. Save updated list back in one write
    pub fn toggle_todo(env: Env, owner: Address, todo_id: u32) {
        owner.require_auth();

        let mut todos: Vec<Todo> = env
            .storage()
            .persistent()
            .get(&DataKey::TodoList(owner.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        if todos.is_empty() {
            panic!("no todos found for this address");
        }

        let mut found = false;
        let mut updated_todos: Vec<Todo> = Vec::new(&env);
        let now = env.ledger().timestamp();

        for i in 0..todos.len() {
            let mut todo = todos.get(i).unwrap();
            if todo.id == todo_id {
                todo.completed = !todo.completed;
                todo.updated_at = now;
                found = true;
            }
            updated_todos.push_back(todo);
        }

        if !found {
            panic!("todo not found");
        }

        env.storage()
            .persistent()
            .set(&DataKey::TodoList(owner.clone()), &updated_todos);
    }

    // ── DELETE TODO ───────────────────────────────────────────────────────────
    // Removes a todo permanently. IDs are never reused.
    // owner: must authorize
    // todo_id: the ID of the todo to remove
    //
    // Implementation:
    // 1. owner.require_auth()
    // 2. Load TodoList(owner) — panic ListEmpty if empty
    // 3. Build a new Vec containing all todos EXCEPT the one with todo_id
    // 4. If new Vec has same length as old Vec → panic TodoNotFound
    // 5. Save updated Vec (one write)
    // OPTIMIZATION: If the resulting list is empty, remove the key entirely
    //               using env.storage().persistent().remove() to free ledger space
    pub fn delete_todo(env: Env, owner: Address, todo_id: u32) {
        owner.require_auth();

        let todos: Vec<Todo> = env
            .storage()
            .persistent()
            .get(&DataKey::TodoList(owner.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        if todos.is_empty() {
            panic!("no todos found for this address");
        }

        let original_len = todos.len();
        let mut updated_todos: Vec<Todo> = Vec::new(&env);

        for i in 0..todos.len() {
            let todo = todos.get(i).unwrap();
            if todo.id != todo_id {
                updated_todos.push_back(todo);
            }
        }

        if updated_todos.len() == original_len {
            panic!("todo not found");
        }

        // STORAGE OPTIMIZATION: remove key entirely if list is now empty
        if updated_todos.is_empty() {
            env.storage()
                .persistent()
                .remove(&DataKey::TodoList(owner.clone()));
        } else {
            env.storage()
                .persistent()
                .set(&DataKey::TodoList(owner.clone()), &updated_todos);
        }
    }

    // ── GET TODOS ─────────────────────────────────────────────────────────────
    // Returns all todos for a wallet address. Public — no auth required.
    // Returns empty Vec if the address has no todos.
    pub fn get_todos(env: Env, owner: Address) -> Vec<Todo> {
        env.storage()
            .persistent()
            .get(&DataKey::TodoList(owner))
            .unwrap_or_else(|| Vec::new(&env))
    }

    // ── GET TODO COUNT ────────────────────────────────────────────────────────
    // Returns the total number of todos ever created for an address
    // (including deleted ones — this is the ID counter, not list length)
    pub fn get_todo_count(env: Env, owner: Address) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TodoCount(owner))
            .unwrap_or(0)
    }

    // ── CLEAR COMPLETED ───────────────────────────────────────────────────────
    // Bulk-deletes all completed todos for a wallet. Auth required.
    // OPTIMIZATION: one read + one write instead of one delete per todo
    // Returns the number of todos that were removed
    pub fn clear_completed(env: Env, owner: Address) -> u32 {
        owner.require_auth();

        let todos: Vec<Todo> = env
            .storage()
            .persistent()
            .get(&DataKey::TodoList(owner.clone()))
            .unwrap_or_else(|| Vec::new(&env));

        let original_len = todos.len();
        let mut remaining: Vec<Todo> = Vec::new(&env);

        for i in 0..todos.len() {
            let todo = todos.get(i).unwrap();
            if !todo.completed {
                remaining.push_back(todo);
            }
        }

        let removed = original_len - remaining.len();

        if removed > 0 {
            if remaining.is_empty() {
                env.storage()
                    .persistent()
                    .remove(&DataKey::TodoList(owner));
            } else {
                env.storage()
                    .persistent()
                    .set(&DataKey::TodoList(owner), &remaining);
            }
        }

        removed
    }
}
```

---

## STEP A-4: Unit Tests

Add a `#[cfg(test)]` module at the bottom of `lib.rs`. Every test must pass with `cargo test`.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, Address, TodoContractClient) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, TodoContract);
        let client = TodoContractClient::new(&env, &contract_id);
        let user = Address::generate(&env);
        (env, user, client)
    }
```

Implement ALL of the following tests completely:

| Test Name | What It Verifies |
|---|---|
| `test_add_todo_success` | Add todo → returns ID 0, `get_todos` returns 1 item with correct text, completed=false |
| `test_add_todo_increments_id` | Add 3 todos → IDs are 0, 1, 2 in order |
| `test_add_todo_empty_text_fails` | Empty string text → panics |
| `test_add_todo_text_too_long_fails` | 257-char string → panics |
| `test_toggle_todo_completes` | Add todo → `toggle_todo` → `get_todos` shows completed=true |
| `test_toggle_todo_uncompletes` | Add todo → toggle → toggle again → completed=false |
| `test_toggle_todo_not_found_fails` | Toggle non-existent ID 99 → panics |
| `test_delete_todo_success` | Add 2 todos → delete ID 0 → `get_todos` returns only 1 |
| `test_delete_todo_not_found_fails` | Delete non-existent ID → panics |
| `test_delete_last_todo_removes_key` | Add 1 todo → delete it → `get_todos` returns empty Vec |
| `test_get_todos_empty` | Fresh address → `get_todos` returns empty Vec |
| `test_get_todo_count` | Add 3 todos → `get_todo_count` returns 3 |
| `test_clear_completed` | Add 3 todos, complete 2 → `clear_completed` returns 2, only 1 remains |
| `test_clear_completed_none` | No completed todos → `clear_completed` returns 0, list unchanged |
| `test_isolation_between_wallets` | Two different addresses each add todos — their lists are completely independent |
| `test_add_after_delete_uses_new_id` | Add (ID=0), delete (ID=0), add again → new todo gets ID=1 (not 0) |

Close the test module with `}`.

---

## STEP A-5: Compile and Test

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
echo "✅ Contract compiled"

cargo test
echo "✅ All 16 tests passed"
cd ..
```

Both commands must exit 0 before proceeding.

---

## STEP A-6: Deployment Scripts

### `scripts/fund-account.sh`
```bash
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
```

### `scripts/deploy.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "════════════════════════════════════"
echo "  stellar-todo — Deploy to Testnet"
echo "════════════════════════════════════"

echo ""
echo "▶ Step 1: Building contract WASM..."
cd contract
cargo build --target wasm32-unknown-unknown --release
cd ..

WASM_PATH="contract/target/wasm32-unknown-unknown/release/stellar_todo.wasm"

echo "▶ Step 2: Optimizing WASM binary..."
stellar contract optimize --wasm "$WASM_PATH"
OPTIMIZED_WASM="${WASM_PATH%.wasm}.optimized.wasm"
echo "   Original:  $(du -sh "$WASM_PATH" | cut -f1)"
echo "   Optimized: $(du -sh "$OPTIMIZED_WASM" | cut -f1)"

echo "▶ Step 3: Deploying to Stellar Testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$OPTIMIZED_WASM" \
  --network testnet \
  --source deployer)

echo ""
echo "✅ Contract deployed!"
echo "   CONTRACT_ID: $CONTRACT_ID"

echo ""
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

echo ""
echo "════════════════════════════════════"
echo "  PHASE A COMPLETE — Start Phase B"
echo "════════════════════════════════════"
```

### `scripts/invoke-test.sh`
```bash
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
echo ""

echo "1️⃣  Adding first todo..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn add_todo \
  -- \
  --owner "$DEPLOYER" \
  --text "Buy groceries"

echo ""
echo "2️⃣  Adding second todo..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn add_todo \
  -- \
  --owner "$DEPLOYER" \
  --text "Ship the dApp"

echo ""
echo "3️⃣  Getting all todos..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn get_todos \
  -- \
  --owner "$DEPLOYER"

echo ""
echo "4️⃣  Toggling first todo (ID 0)..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn toggle_todo \
  -- \
  --owner "$DEPLOYER" \
  --todo_id 0

echo ""
echo "5️⃣  Clearing completed..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn clear_completed \
  -- \
  --owner "$DEPLOYER"

echo ""
echo "6️⃣  Verifying final state..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source deployer \
  --fn get_todos \
  -- \
  --owner "$DEPLOYER"

echo ""
echo "✅ All smoke tests passed"
```

### Run Phase A

```bash
chmod +x scripts/*.sh
./scripts/fund-account.sh
./scripts/deploy.sh
./scripts/invoke-test.sh
```

---

## ⛔ PHASE A GATE — Do NOT proceed to Phase B unless ALL are true:

- [ ] `cargo test` exits 0 — all 16 tests show `ok`
- [ ] `deploy.sh` exits 0 — shows `✅ Contract deployed!`
- [ ] `frontend/.env` exists with `VITE_CONTRACT_ID=C...` (56 chars, starts with C)
- [ ] `invoke-test.sh` exits 0 — shows `✅ All smoke tests passed`

---

# ══════════════════════════════════════════════
# PHASE B — FRONTEND
# Only begin after all Phase A gate conditions are confirmed
# ══════════════════════════════════════════════

## STEP B-1: Bootstrap Frontend

```bash
cd stellar-todo
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install @stellar/stellar-sdk @stellar/freighter-api
```

Verify `frontend/.env` already exists from Phase A. If it doesn't — STOP and re-run `scripts/deploy.sh`.

---

## STEP B-2: `frontend/src/types/index.ts`

```typescript
// ── Todo types ───────────────────────────────────────────────────
export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: number;    // Unix timestamp (seconds)
  updatedAt: number;
}

// ── Transaction status machine ───────────────────────────────────
export type TxStatus =
  | 'idle'
  | 'building'
  | 'awaiting_signature'
  | 'submitting'
  | 'polling'
  | 'success'
  | 'failed';

export interface TxState {
  status: TxStatus;
  txHash: string | null;
  error: string | null;
  action: string | null;   // human label e.g. "Adding todo", "Deleting todo"
}

export const INITIAL_TX_STATE: TxState = {
  status: 'idle',
  txHash: null,
  error: null,
  action: null,
};

// ── Wallet state ─────────────────────────────────────────────────
export interface WalletState {
  publicKey: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
}
```

---

## STEP B-3: `frontend/src/lib/wallet.ts`

```typescript
import {
  isConnected,
  requestAccess,
  getPublicKey,
  getNetworkDetails,
  signTransaction,
} from '@stellar/freighter-api';

const EXPECTED_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE as string;

export interface WalletInfo {
  publicKey: string;
  isCorrectNetwork: boolean;
}

// Check if wallet is already connected (on app load)
export async function checkExistingConnection(): Promise<string | null> {
  try {
    const connected = await isConnected();
    if (!connected) return null;
    return await getPublicKey();
  } catch {
    return null;
  }
}

// Trigger connect flow
export async function connectFreighter(): Promise<WalletInfo> {
  const connected = await isConnected();
  if (!connected) {
    throw new Error(
      'Freighter wallet not found. Install it from freighter.app and refresh.'
    );
  }
  await requestAccess();
  const publicKey = await getPublicKey();
  const details = await getNetworkDetails();
  return {
    publicKey,
    isCorrectNetwork: details.networkPassphrase === EXPECTED_PASSPHRASE,
  };
}

// Re-export sign for use in contract.ts
export { signTransaction };

// Utility: truncate Stellar address for display
export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
```

---

## STEP B-4: `frontend/src/lib/contract.ts`

This is the most critical file. Implement every function completely. Zero stubs.

```typescript
import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  nativeToScVal,
  Address,
  xdr,
  scValToNative,
} from '@stellar/stellar-sdk';
import { signTransaction } from './wallet';
import type { Todo, TxStatus } from '@/types';

const CONTRACT_ID  = import.meta.env.VITE_CONTRACT_ID as string;
const RPC_URL      = import.meta.env.VITE_RPC_URL as string;
const NET_PASS     = import.meta.env.VITE_NETWORK_PASSPHRASE as string;

const server   = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
const contract = new Contract(CONTRACT_ID);

// ── Shared tx lifecycle ─────────────────────────────────────────────────────
// Build → Simulate → Assemble → Sign → Submit → Poll
async function runTx(
  sourcePublicKey: string,
  operation: xdr.Operation,
  onStatus: (s: TxStatus) => void,
): Promise<string> {
  onStatus('building');

  const account = await server.getAccount(sourcePublicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NET_PASS,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();

  onStatus('awaiting_signature');
  const signedXdr = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NET_PASS,
  });

  onStatus('submitting');
  const sendResult = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NET_PASS),
  );

  if (sendResult.status === 'ERROR') {
    throw new Error(sendResult.errorResult?.toString() ?? 'Submission failed');
  }

  onStatus('polling');
  const hash = sendResult.hash;

  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(r => setTimeout(r, 1500));
    const pollResult = await server.getTransaction(hash);
    if (pollResult.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      onStatus('success');
      return hash;
    }
    if (pollResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Transaction failed on-chain');
    }
  }

  throw new Error('Transaction timed out after 30 seconds');
}

// ── Read-only simulation (no fees, no signing) ──────────────────────────────
async function readTx<T>(operation: xdr.Operation): Promise<T> {
  // Build a dummy transaction for simulation only
  const account = await server.getAccount(CONTRACT_ID).catch(() => ({
    accountId: () => CONTRACT_ID,
    sequenceNumber: () => '0',
    incrementSequenceNumber() {},
  } as unknown as SorobanRpc.Api.AccountResponse));

  const tx = new TransactionBuilder(account as any, {
    fee: BASE_FEE,
    networkPassphrase: NET_PASS,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Read simulation failed: ${sim.error}`);
  }

  const success = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  return scValToNative(success.result!.retval) as T;
}

// ── Decode a raw ScVal map into a Todo ──────────────────────────────────────
function decodeTodo(raw: unknown): Todo {
  const obj = raw as Record<string, unknown>;
  return {
    id:          Number(obj['id']),
    text:        String(obj['text']),
    completed:   Boolean(obj['completed']),
    createdAt:   Number(obj['created_at']),
    updatedAt:   Number(obj['updated_at']),
  };
}

// ── Exported contract functions ─────────────────────────────────────────────

export async function contractAddTodo(
  ownerPublicKey: string,
  text: string,
  onStatus: (s: TxStatus) => void,
): Promise<{ txHash: string; newId: number }> {
  const op = contract.call(
    'add_todo',
    new Address(ownerPublicKey).toScVal(),
    nativeToScVal(text, { type: 'string' }),
  );
  const txHash = await runTx(ownerPublicKey, op, onStatus);
  // Read back to get the new ID (or parse from return value)
  const todos = await contractGetTodos(ownerPublicKey);
  const newId = todos.length > 0 ? todos[todos.length - 1].id : 0;
  return { txHash, newId };
}

export async function contractToggleTodo(
  ownerPublicKey: string,
  todoId: number,
  onStatus: (s: TxStatus) => void,
): Promise<string> {
  const op = contract.call(
    'toggle_todo',
    new Address(ownerPublicKey).toScVal(),
    nativeToScVal(todoId, { type: 'u32' }),
  );
  return runTx(ownerPublicKey, op, onStatus);
}

export async function contractDeleteTodo(
  ownerPublicKey: string,
  todoId: number,
  onStatus: (s: TxStatus) => void,
): Promise<string> {
  const op = contract.call(
    'delete_todo',
    new Address(ownerPublicKey).toScVal(),
    nativeToScVal(todoId, { type: 'u32' }),
  );
  return runTx(ownerPublicKey, op, onStatus);
}

export async function contractGetTodos(ownerPublicKey: string): Promise<Todo[]> {
  const op = contract.call(
    'get_todos',
    new Address(ownerPublicKey).toScVal(),
  );
  const raw = await readTx<unknown[]>(op);
  return Array.isArray(raw) ? raw.map(decodeTodo) : [];
}

export async function contractClearCompleted(
  ownerPublicKey: string,
  onStatus: (s: TxStatus) => void,
): Promise<{ txHash: string; removedCount: number }> {
  const op = contract.call(
    'clear_completed',
    new Address(ownerPublicKey).toScVal(),
  );
  const txHash = await runTx(ownerPublicKey, op, onStatus);
  return { txHash, removedCount: 0 }; // exact count read from chain if needed
}
```

---

## STEP B-5: `frontend/src/context/WalletContext.tsx`

```typescript
'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { connectFreighter, checkExistingConnection } from '@/lib/wallet';
import type { WalletState } from '@/types';

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    publicKey: null,
    isConnected: false,
    isCorrectNetwork: false,
  });

  // Check if already connected on mount
  useEffect(() => {
    checkExistingConnection().then(pk => {
      if (pk) setState({ publicKey: pk, isConnected: true, isCorrectNetwork: true });
    });
  }, []);

  const connect = useCallback(async () => {
    const info = await connectFreighter();
    setState({ publicKey: info.publicKey, isConnected: true, isCorrectNetwork: info.isCorrectNetwork });
  }, []);

  const disconnect = useCallback(() => {
    setState({ publicKey: null, isConnected: false, isCorrectNetwork: false });
  }, []);

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWalletContext must be used within WalletProvider');
  return ctx;
}
```

---

## STEP B-6: Hooks

### `frontend/src/hooks/useWallet.ts`
```typescript
// Re-exports useWalletContext for components — thin wrapper
// Returns: { publicKey, isConnected, isCorrectNetwork, connect, disconnect }
// IMPLEMENT FULLY — import from WalletContext and re-export
```

### `frontend/src/hooks/useTodos.ts`
```typescript
// Manages all todo state for the current wallet
//
// State:
//   todos: Todo[]
//   loading: boolean        — true during initial fetch
//   txState: TxState        — tracks in-flight mutations
//
// Actions (all update txState through full lifecycle):
//   addTodo(text: string): Promise<void>
//   toggleTodo(id: number): Promise<void>
//   deleteTodo(id: number): Promise<void>
//   clearCompleted(): Promise<void>
//   refresh(): Promise<void>    — re-fetches todos from chain
//
// Behavior:
//   - Fetch todos on mount and whenever publicKey changes
//   - After each successful mutation: call refresh()
//   - On any error: set txState.status = 'failed', txState.error = message
//   - Reset txState to INITIAL_TX_STATE after 4 seconds on success
//
// IMPLEMENT FULLY
```

---

## STEP B-7: Components

### `ConnectWallet.tsx`
```tsx
// Uses useWalletContext()
//
// When disconnected:
//   - Single button: "Connect Freighter"
//   - onClick: calls connect()
//   - Shows spinner while connecting
//
// When connected + correct network:
//   - Shows truncated public key (via truncateAddress)
//   - "Disconnect" button
//
// When connected + WRONG network:
//   - Red warning banner: "⚠️ Switch to Stellar Testnet in Freighter"
//   - Disable all actions while wrong network
//
// Styling: minimal — flex row, plain button styles, no heavy CSS
// IMPLEMENT FULLY
```

### `TxStatusBar.tsx`
```tsx
// Props: txState: TxState
//
// Renders a single horizontal status strip at the top of the todo list area
// Hidden when txState.status === 'idle'
//
// Status → display:
//   building           → ⚙️  "{action}..." (e.g. "Adding todo...")
//   awaiting_signature → ✍️  "Sign in Freighter..."
//   submitting         → 📤  "Submitting to Stellar..."
//   polling            → 🔄  "Confirming..." (spinning icon via CSS animation)
//   success            → ✅  "Done!" + short txHash link to Stellar Expert testnet
//   failed             → ❌  "Failed: {error}"
//
// The Stellar Expert URL format:
//   https://stellar.expert/explorer/testnet/tx/{txHash}
//
// Auto-dismisses (returns to idle) 4 seconds after success
// IMPLEMENT FULLY — no missing states
```

### `TodoInput.tsx`
```tsx
// Props: onAdd: (text: string) => Promise<void>, disabled: boolean
//
// - Controlled text input (useState)
// - Placeholder: "What needs to be done?"
// - "Add" button to the right of the input
// - Submits on Enter key OR button click
// - Trims whitespace before calling onAdd
// - Clears input after successful add
// - Disabled (input + button) when: disabled=true OR text is empty
// - Shows inline char count when text.length > 200: "{n}/256"
// - Input turns red border when text.length > 256
// IMPLEMENT FULLY
```

### `TodoItem.tsx`
```tsx
// Props:
//   todo: Todo
//   onToggle: (id: number) => Promise<void>
//   onDelete: (id: number) => Promise<void>
//   disabled: boolean    ← true when any tx is in-flight
//
// Layout (horizontal row):
//   [Checkbox/Toggle]  [Todo text]  [Delete button]
//
// - Checkbox: clicking calls onToggle(todo.id)
//   - Checked state: render a filled circle or ✓ mark
//   - Unchecked: empty circle
// - Todo text:
//   - If completed: line-through text, muted color
//   - If not: normal text
// - Delete button: "×" or trash icon — calls onDelete(todo.id)
// - Both actions disabled while disabled=true
// - Show creation date on hover/tooltip: formatTimestamp(todo.createdAt)
// IMPLEMENT FULLY
```

### `TodoList.tsx`
```tsx
// Props:
//   todos: Todo[]
//   onToggle: (id: number) => Promise<void>
//   onDelete: (id: number) => Promise<void>
//   onClearCompleted: () => Promise<void>
//   loading: boolean
//   txInFlight: boolean    ← true when any tx is in progress
//
// Renders:
//   1. If loading: show 3 skeleton rows (animated gray bars)
//   2. If todos.length === 0 and !loading:
//        Empty state: "No todos yet. Add one above!"
//   3. If todos.length > 0:
//        - List of TodoItem components
//        - Footer row:
//            Left:  "{n} item(s) left" (count of non-completed)
//            Right: "Clear completed" button (hidden if no completed todos)
//
// IMPLEMENT FULLY
```

---

## STEP B-8: App Shell

### `frontend/src/App.tsx`
```tsx
// Layout:
//
// ┌──────────────────────────────────┐
// │  ☑  Stellar Todo                 │ ← App title (h1)
// │         [ConnectWallet]          │ ← right-aligned
// ├──────────────────────────────────┤
// │  [TxStatusBar]                   │ ← shows when tx active
// ├──────────────────────────────────┤
// │  [TodoInput]                     │ ← shown only when connected
// │  [TodoList]                      │ ← shown only when connected
// │                                  │
// │  (if not connected:)             │
// │   "Connect your Freighter wallet │
// │    to manage your todos"         │
// └──────────────────────────────────┘
//
// - WalletProvider wraps everything
// - useTodos hook provides todo state + actions to TodoInput and TodoList
// - TodoInput disabled while any tx is in-flight (txState.status !== 'idle')
// - Max width: 600px, centered, clean white/light background
// IMPLEMENT FULLY
```

### `frontend/src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#ef4444' }}>{this.state.error}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

---

## STEP B-9: Configuration Files

### `frontend/vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util'],
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

```bash
npm install --save-dev vite-plugin-node-polyfills @types/node
```

### `frontend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### `frontend/index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Stellar Todo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `frontend/src/index.css` — Minimal Global Styles
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f5f5f5;
  color: #1a1a1a;
  min-height: 100vh;
}

button {
  cursor: pointer;
  border: none;
  background: none;
  font-size: inherit;
  font-family: inherit;
}

input {
  font-size: inherit;
  font-family: inherit;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.spin { animation: spin 1s linear infinite; }
.pulse { animation: pulse 1.5s ease-in-out infinite; }
```

### `.gitignore`
```
target/
node_modules/
.env
.next/
dist/
*.wasm
```

### `.env.example` (root level)
```env
VITE_CONTRACT_ID=C...
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
```

---

## STEP B-10: Verify and Launch

```bash
cd frontend
npm run build    # must exit 0 — zero TypeScript errors
npm run dev      # open http://localhost:5173
```

**QA Checklist:**
- [ ] Page loads, shows "Stellar Todo" title
- [ ] "Connect Freighter" button visible
- [ ] Click Connect → Freighter popup → after connect, public key shown
- [ ] Todo input field visible and enabled
- [ ] Type a todo, click Add → all 5 TxStatusBar stages cycle → todo appears
- [ ] Click toggle → todo gets strikethrough
- [ ] Click delete → todo removed from list
- [ ] "Clear completed" appears when completed todos exist → click removes them
- [ ] Wrong network → red warning banner shown
- [ ] `npm run build` exits 0

---

## ✅ QUALITY REQUIREMENTS

| Requirement | Standard |
|---|---|
| TypeScript | `strict: true`, zero `any`, all props typed |
| Rust | Compiles WASM, all 16 tests pass |
| Storage | Vec-per-wallet (not key-per-todo) — optimized pattern |
| Auth | `require_auth()` on every mutating function |
| Env vars | Read from `import.meta.env.VITE_*`, never hardcoded |
| TxStatusBar | All 6 status states handled, never shows idle |
| Loading | Initial fetch shows skeleton, mutations disable inputs |
| Empty state | Friendly message when no todos |
| Responsive | Works at 375px mobile and 1440px desktop |
| Console | Zero `console.log` — `console.error` for real errors only |
| No TODOs | Every function fully implemented |

---

## 📝 COMPLETE FILE GENERATION ORDER

Print `✅ [filename] — complete` after each file before proceeding:

**Phase A:**
1. `contract/Cargo.toml`
2. `contract/src/lib.rs` ← full contract + all 16 unit tests
3. `.gitignore`
4. `.env.example`
5. `scripts/fund-account.sh`
6. `scripts/deploy.sh`
7. `scripts/invoke-test.sh`

**[EXECUTE: fund-account.sh → deploy.sh → invoke-test.sh → confirm gate]**

**Phase B:**
8. `frontend/package.json`
9. `frontend/tsconfig.json`
10. `frontend/vite.config.ts`
11. `frontend/index.html`
12. `frontend/src/index.css`
13. `frontend/.env.example`
14. `frontend/src/types/index.ts`
15. `frontend/src/lib/wallet.ts`
16. `frontend/src/lib/contract.ts`
17. `frontend/src/context/WalletContext.tsx`
18. `frontend/src/hooks/useWallet.ts`
19. `frontend/src/hooks/useTodos.ts`
20. `frontend/src/components/ConnectWallet.tsx`
21. `frontend/src/components/TxStatusBar.tsx`
22. `frontend/src/components/TodoInput.tsx`
23. `frontend/src/components/TodoItem.tsx`
24. `frontend/src/components/TodoList.tsx`
25. `frontend/src/App.tsx`
26. `frontend/src/main.tsx`
27. `README.md`
