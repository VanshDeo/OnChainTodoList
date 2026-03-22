# 🛠 SKILLS.md — Web3 Todo dApp on Stellar Soroban

All technical skill domains required to build, test, and deploy the `stellar-todo` dApp. Skills are tagged with which phase they belong to.

---

## 1. Rust — Soroban Smart Contract Development
**Phase:** A | **Level:** Intermediate–Advanced

### SDK Macros & Annotations
- `#![no_std]` — no standard library; Soroban runs in a WASM sandbox
- `#[contract]` — marks the contract struct
- `#[contractimpl]` — marks the implementation block exported on-chain
- `#[contracttype]` — marks enums/structs for on-chain binary serialization
- `#[contracterror]` — defines typed error codes surfaced to callers

### Soroban Native Types
- `Address` — Stellar account or contract; call `.require_auth()` to enforce signature
- `String` — on-chain string from `soroban_sdk::String`, NOT `std::String`
- `Vec<T>` — append-only on-chain growable list; supports `.push_back()`, `.get(i)`, `.len()`, `.is_empty()`
- `u32`, `u64`, `bool` — numeric and boolean primitives
- `Env` — environment handle; access storage, ledger, events through it

### Storage Tiers — Critical for Optimization
Soroban has three storage tiers with different cost/TTL profiles:

| Tier | API | TTL Behavior | Best For |
|---|---|---|---|
| **Instance** | `env.storage().instance()` | Tied to contract instance TTL | Lightweight counters, config |
| **Persistent** | `env.storage().persistent()` | Has its own TTL (must be extended) | Large data, user todos |
| **Temporary** | `env.storage().temporary()` | Short TTL, auto-expires | Nonces, sessions |

**This project's storage strategy:**
- `TodoCount(Address)` → **instance storage** (cheap counter, small value)
- `TodoList(Address)` → **persistent storage** (large Vec, user-owned data)

### The Vec-Per-Wallet Optimization (Core Skill)
Most naive implementations create one storage key per todo item:
```
TodoItem(owner, 0) → Todo
TodoItem(owner, 1) → Todo
TodoItem(owner, 2) → Todo   ← 3 storage reads for 3 todos
```

This project uses the optimized pattern — one key for the entire list:
```
TodoList(owner) → Vec<Todo>   ← 1 storage read for ALL todos
```

**Why it matters:**
- Storage reads/writes are metered in Stellar — one entry is exponentially cheaper
- TTL rent is paid per-key — fewer keys = lower ongoing cost
- Key collision risk is eliminated
- A single atomic write guarantees consistency

**Trade-off to know:** With a large Vec, every operation loads and rewrites the full list. For <1000 todos per wallet this is completely fine — the data fits in one ledger entry.

### Key-Deletion Optimization
When a todo list becomes empty after deletion, remove the storage key entirely:
```rust
env.storage().persistent().remove(&DataKey::TodoList(owner));
```
This frees ledger space and stops TTL rent from accumulating on an empty entry.

### Iteration Pattern for Vec Mutation
Soroban `Vec` does not support `.retain()` or index mutation directly. The correct pattern:
```rust
let mut updated: Vec<T> = Vec::new(&env);
for i in 0..source.len() {
    let item = source.get(i).unwrap();
    if keep_condition(&item) {
        updated.push_back(item);
    }
}
```

### Auth Model
- Every mutating function calls `owner.require_auth()` before any state reads
- This ensures only the owning wallet can add/toggle/delete their own todos
- `get_todos` is intentionally public (no auth) — anyone can read any wallet's todos

### Unit Testing
- `Env::default()` — clean in-memory test environment
- `env.mock_all_auths()` — automatically satisfies all `require_auth()` calls in tests
- `Address::generate(&env)` — create mock addresses
- `env.register_contract(None, TodoContract)` — deploy contract in test context
- `TodoContractClient::new(&env, &contract_id)` — generated type-safe client
- Test isolation: each `#[test]` function calls `setup()` to get a fresh environment

---

## 2. Soroban Storage Optimization
**Phase:** A | **Level:** Intermediate

### Why Storage Optimization Matters on Stellar
- Every ledger entry costs **rent** (XLM per byte per ledger period)
- Every read/write consumes **resource fees** charged per operation
- Entries with unpaid TTL are archived and require restore operations
- Smaller WASM binary = lower deployment cost (hence `opt-level = "z"`)

### Techniques Used in This Project
1. **Vec-per-wallet**: bundle all todos into one storage entry
2. **Instance storage for counters**: monotonic ID counter uses cheaper instance tier
3. **Key removal on empty**: delete the `TodoList` key when the list becomes empty
4. **Bulk operations**: `clear_completed` does one read + one write instead of one delete-per-todo
5. **WASM optimization**: `lto = true`, `opt-level = "z"`, `strip = "symbols"` in release profile

---

## 3. Stellar CLI — Testnet Operations
**Phase:** A | **Level:** Intermediate

### Essential Commands
```bash
# Key management
stellar keys generate deployer --network testnet
stellar keys address deployer
stellar keys ls

# Funding
curl https://friendbot.stellar.org?addr=<PUBLIC_KEY>

# Build pipeline
cargo build --target wasm32-unknown-unknown --release
stellar contract optimize --wasm <path.wasm>

# Deploy
stellar contract deploy --wasm <optimized.wasm> --network testnet --source deployer

# Invoke
stellar contract invoke --id <CONTRACT_ID> --network testnet --source deployer \
  --fn add_todo -- --owner <ADDRESS> --text "My first todo"
```

### Output Capture for Scripting
```bash
CONTRACT_ID=$(stellar contract deploy --wasm ... --network testnet --source deployer)
echo "VITE_CONTRACT_ID=$CONTRACT_ID" > frontend/.env
```

---

## 4. Stellar JavaScript SDK (TypeScript)
**Phase:** B | **Level:** Advanced

### Transaction Lifecycle (memorize this flow)
```
1. getAccount(publicKey)         → fetch source account + sequence number
2. TransactionBuilder(...)       → set fee, network passphrase, timeout
3. .addOperation(contract.call)  → add Soroban invocation operation
4. .build()                      → produce unsigned transaction
5. simulateTransaction(tx)       → get resource fees + footprint (READ THIS!)
6. isSimulationError(sim)        → check for errors before proceeding
7. assembleTransaction(tx, sim)  → apply footprint + auth entries
8. .build()                      → assembled transaction ready for signing
9. signTransaction(xdr, {pass})  → Freighter signing popup
10. sendTransaction(signed)      → submit to RPC node
11. getTransaction(hash) × poll  → wait for SUCCESS or FAILED
```

### Argument Encoding for This Contract
```typescript
// Address
new Address(publicKey).toScVal()

// String
nativeToScVal('Buy groceries', { type: 'string' })

// u32 (todo ID)
nativeToScVal(0, { type: 'u32' })
```

### Decoding Return Values
```typescript
// From simulation result
const retval = (sim as SimulateTransactionSuccessResponse).result!.retval;
const native = scValToNative(retval);

// Vec<Todo> decoding: native is an array of objects
const todos = (native as unknown[]).map(raw => {
  const obj = raw as Record<string, unknown>;
  return {
    id:        Number(obj['id']),
    text:      String(obj['text']),
    completed: Boolean(obj['completed']),
    createdAt: Number(obj['created_at']),
    updatedAt: Number(obj['updated_at']),
  };
});
```

### Read vs Write Pattern
- **Write operations** (add, toggle, delete, clear): full lifecycle — simulate → sign → submit → poll
- **Read operations** (get_todos): simulate only — no signing, no fees, instant response

---

## 5. Freighter Wallet Integration
**Phase:** B | **Level:** Intermediate

### API Surface Used in This Project
```typescript
import {
  isConnected,      // → boolean: extension installed and user connected
  requestAccess,    // → void: trigger permission popup
  getPublicKey,     // → string: G... address
  getNetworkDetails,// → { networkPassphrase, network }
  signTransaction,  // → string: signed XDR
} from '@stellar/freighter-api';
```

### Connection Flow
```typescript
// On app load: check silently
const pk = await getPublicKey().catch(() => null);

// On button click: full connect
await isConnected()         // throws if not installed
await requestAccess()       // user sees permission popup
const pk = await getPublicKey()
const net = await getNetworkDetails()
const isCorrect = net.networkPassphrase === EXPECTED_PASSPHRASE
```

### Error Scenarios to Handle
| Error | User-facing message |
|---|---|
| Freighter not installed | "Install Freighter from freighter.app" |
| User rejects permission | "Connection cancelled" |
| User rejects signing | "Transaction cancelled — you rejected the signature" |
| Wrong network | Red banner: "Switch to Stellar Testnet in Freighter" |

---

## 6. React 18 + TypeScript + Vite
**Phase:** B | **Level:** Intermediate–Advanced

### TypeScript Strict Mode Requirements
- `"strict": true` in tsconfig
- Zero `any` — use `unknown` and narrow with type guards
- All component props typed with named interfaces
- `Record<string, unknown>` pattern for decoding XDR objects

### Custom Hook Patterns
```typescript
// useTodos — manages all todo state
interface UseTodosReturn {
  todos: Todo[];
  loading: boolean;
  txState: TxState;
  addTodo: (text: string) => Promise<void>;
  toggleTodo: (id: number) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
  clearCompleted: () => Promise<void>;
  refresh: () => Promise<void>;
}
```

### TxState as a Status Machine
```
idle → building → awaiting_signature → submitting → polling → success
                                                            ↘ failed
```
- Only one state at a time
- UI disables inputs during any non-idle state
- `action` field holds human label: "Adding todo", "Toggling todo", etc.
- Auto-reset to `INITIAL_TX_STATE` after 4s on success

### React Context Pattern
- `WalletContext` created with `createContext<T | null>(null)`
- Provider in `App.tsx` wraps entire tree
- Consumer hook `useWalletContext()` throws if used outside provider
- No prop drilling for wallet state

### Vite + Node Polyfills
Stellar SDK uses Node.js APIs (`Buffer`, `crypto`, `stream`) — they don't exist in browsers.
Fix with `vite-plugin-node-polyfills`:
```typescript
// vite.config.ts
import { nodePolyfills } from 'vite-plugin-node-polyfills';
plugins: [react(), nodePolyfills({ include: ['buffer', 'crypto', 'stream'] })]
```

---

## 7. Minimal UI Design (No Heavy Styling)
**Phase:** B | **Level:** Basic

### Design Rules for This Project
- **No CSS framework** (no Tailwind, no MUI, no Chakra)
- Plain CSS in `index.css` + inline styles where needed
- Clean, functional aesthetic — purpose is clarity of logic, not visual wow
- Font: system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- Max width: `600px`, centered with `margin: 0 auto`
- Color palette: white cards on light gray background, red for errors, green for success

### Component Styling Philosophy
- Each component handles its own visual state (completed = line-through, error = red border)
- Animation only for: spinner during polling, pulse for skeleton loading
- Two CSS keyframes: `@keyframes spin` and `@keyframes pulse`
- Status colors: `#22c55e` (green/success), `#ef4444` (red/error), `#3b82f6` (blue/info)

---

## 8. Web3 Security Practices
**Phase:** A + B | **Level:** Intermediate

### Contract Security
- `require_auth()` on every state-mutating function — no exceptions
- Wallet address as the natural access control key (no separate ACL needed)
- Text length validation on-chain (not just in UI) — prevents storage bloat attacks
- IDs are monotonically increasing and never reused — no ID collision risk

### Frontend Security
- Network passphrase validated before any transaction — prevents mainnet accidents
- Contract ID read from `import.meta.env.VITE_CONTRACT_ID` — never hardcoded
- `VITE_*` vars are public (exposed in bundle) — no secrets stored here
- `.env` excluded from git via `.gitignore`

---

## 9. Bash Scripting — Agentic Deployment
**Phase:** A | **Level:** Basic–Intermediate

### Key Patterns Used
```bash
set -euo pipefail              # fail fast on error, undefined var, pipe failure

# Capture CLI output
CONTRACT_ID=$(stellar contract deploy ...)

# Heredoc to write .env file
cat > frontend/.env <<EOF
VITE_CONTRACT_ID=$CONTRACT_ID
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
EOF

# Conditional identity creation
if ! stellar keys address deployer &>/dev/null; then
  stellar keys generate deployer --network testnet
fi

# Source env in test script
source frontend/.env
CONTRACT_ID=$VITE_CONTRACT_ID
```

### The Deploy → Write → Connect Pipeline
This is the critical automation pattern for agentic workflows:
1. `deploy.sh` captures `CONTRACT_ID` and writes it to `frontend/.env`
2. Frontend reads it via `import.meta.env.VITE_CONTRACT_ID` at build time
3. No manual copy-paste required — the pipeline is fully automated

---

## Skill Summary Table

| # | Domain | Phase | Level | Primary Tools |
|---|---|---|---|---|
| 1 | Rust / Soroban SDK | A | Intermediate–Advanced | `soroban-sdk`, `cargo` |
| 2 | Soroban Storage Optimization | A | Intermediate | Vec-per-wallet, key deletion, tiers |
| 3 | Stellar CLI & Testnet | A | Intermediate | `stellar` CLI, Friendbot |
| 4 | Stellar JS/TS SDK | B | Advanced | `stellar-sdk`, Soroban RPC |
| 5 | Freighter Wallet Integration | B | Intermediate | `@stellar/freighter-api` |
| 6 | React 18 + TypeScript + Vite | B | Intermediate–Advanced | Vite, React 18, TS strict |
| 7 | Minimal UI Design | B | Basic | Plain CSS, system fonts |
| 8 | Web3 Security | A + B | Intermediate | Auth, env hygiene |
| 9 | Bash Scripting & Deployment | A | Basic–Intermediate | `deploy.sh`, heredoc, capture |
