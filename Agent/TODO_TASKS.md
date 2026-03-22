# ✅ TASKS.md — Web3 Todo dApp on Stellar Soroban

Dependency-ordered task breakdown for `stellar-todo`. Organized into two strict phases. **Phase A must be 100% complete before Phase B begins.** The gate condition is non-negotiable.

---

# ⛓ PHASE A — SMART CONTRACT
> Gate condition: `frontend/.env` must exist containing `VITE_CONTRACT_ID=C...`
> Do NOT start Phase B until this gate is confirmed.

---

## A1 — Environment Setup

- [ ] **T-001** Install Rust via `rustup`
  - Verify: `rustc --version` → shows version ≥ 1.74
- [ ] **T-002** Add WASM target: `rustup target add wasm32-unknown-unknown`
  - Verify: `rustup target list --installed | grep wasm32`
- [ ] **T-003** Install Stellar CLI
  - Verify: `stellar --version`
- [ ] **T-004** Install Node.js v20 LTS
  - Verify: `node --version` → `v20.x.x`
- [ ] **T-005** Install Freighter browser extension (Chrome/Brave/Firefox)
  - Set network to **Testnet** inside Freighter settings panel
- [ ] **T-006** Create project structure
  ```bash
  mkdir -p stellar-todo/contract/src stellar-todo/scripts
  cd stellar-todo && git init
  ```
- [ ] **T-007** Create root `.gitignore`
  - Entries: `target/`, `node_modules/`, `.env`, `*.wasm`, `dist/`, `.next/`

---

## A2 — Contract Scaffolding

- [ ] **T-101** Create `contract/Cargo.toml`
  - `name = "stellar-todo"`, `crate-type = ["cdylib"]`
  - `soroban-sdk = { version = "20.0.0", features = ["alloc"] }`
  - `[dev-dependencies]` with `testutils` feature
  - Full `[profile.release]` with `opt-level = "z"`, `lto = true`, `panic = "abort"`, `strip = "symbols"`
- [ ] **T-102** Create empty `contract/src/lib.rs` with `#![no_std]` and imports skeleton
- [ ] **T-103** Verify clean initial compile:
  ```bash
  cd contract && cargo build --target wasm32-unknown-unknown --release && cd ..
  ```
  Must exit 0 before adding any logic.

---

## A3 — Data Model

- [ ] **T-104** Define `Todo` struct with `#[contracttype]` and `#[derive(Clone, Debug, PartialEq)]`
  - Fields: `id: u32`, `text: String`, `completed: bool`, `created_at: u64`, `updated_at: u64`
- [ ] **T-105** Define `DataKey` enum with `#[contracttype]`
  - Variants:
    - `TodoList(Address)` — maps to persistent storage (Vec of todos)
    - `TodoCount(Address)` — maps to instance storage (u32 counter)
- [ ] **T-106** Define `TodoError` enum with `#[contracterror]` and `#[derive(Copy, Clone, Debug, PartialEq)]`
  - Variants with codes: `TodoNotFound=1`, `TextTooLong=2`, `EmptyText=3`, `AlreadyCompleted=4`, `AlreadyIncomplete=5`, `ListEmpty=6`
- [ ] **T-107** Add `#[contract]` to `TodoContract` struct and `#[contractimpl]` to its impl block

---

## A4 — Contract Function: `add_todo`

- [ ] **T-108** Implement `add_todo(env: Env, owner: Address, text: String) -> u32`
  - Call `owner.require_auth()`
  - Validate `text.len() == 0` → panic with `"todo text cannot be empty"`
  - Validate `text.len() > 256` → panic with `"todo text exceeds 256 character limit"`
  - Read `TodoCount(owner)` from **instance storage** (default 0)
  - Use count as new todo ID; increment and save back to instance storage
  - Read `TodoList(owner)` from **persistent storage** (default empty `Vec::new(&env)`)
  - Build `Todo { id, text, completed: false, created_at: now, updated_at: now }`
  - Push todo to Vec, save entire Vec back to persistent storage (one write)
  - Return new todo ID

---

## A5 — Contract Function: `toggle_todo`

- [ ] **T-109** Implement `toggle_todo(env: Env, owner: Address, todo_id: u32)`
  - Call `owner.require_auth()`
  - Load `TodoList(owner)` — panic `"no todos found"` if empty
  - Iterate Vec, find item where `todo.id == todo_id`
  - Flip `todo.completed` boolean, set `todo.updated_at = env.ledger().timestamp()`
  - Build new Vec with updated item, save in one write
  - Panic `"todo not found"` if no item with that ID was found

---

## A6 — Contract Function: `delete_todo`

- [ ] **T-110** Implement `delete_todo(env: Env, owner: Address, todo_id: u32)`
  - Call `owner.require_auth()`
  - Load `TodoList(owner)` — panic `"no todos found"` if empty
  - Build new Vec containing all items where `todo.id != todo_id`
  - If new Vec length == original length → panic `"todo not found"` (ID didn't exist)
  - **Optimization:** if new Vec is empty → call `env.storage().persistent().remove(&DataKey::TodoList(owner))` to free ledger space
  - Otherwise save updated Vec in one write

---

## A7 — Contract Function: `get_todos`

- [ ] **T-111** Implement `get_todos(env: Env, owner: Address) -> Vec<Todo>`
  - Read `TodoList(owner)` from persistent storage
  - Return the Vec or `Vec::new(&env)` if the key doesn't exist
  - **No auth required** — public read function

---

## A8 — Contract Function: `get_todo_count`

- [ ] **T-112** Implement `get_todo_count(env: Env, owner: Address) -> u32`
  - Read `TodoCount(owner)` from instance storage
  - Return value or 0 if not set
  - No auth required

---

## A9 — Contract Function: `clear_completed`

- [ ] **T-113** Implement `clear_completed(env: Env, owner: Address) -> u32`
  - Call `owner.require_auth()`
  - Load `TodoList(owner)` — return 0 early if empty
  - Build new Vec with only items where `todo.completed == false`
  - Compute `removed = original_len - new_len`
  - If `removed > 0`: save updated list (or remove key if now empty)
  - Return `removed` count
  - **Optimization:** single read + single write for bulk deletion

---

## A10 — Unit Tests

- [ ] **T-114** Create `#[cfg(test)]` module at bottom of `lib.rs`
  - Implement `setup()` helper: returns `(Env, Address, TodoContractClient)`
  - `env.mock_all_auths()` inside setup

- [ ] **T-115** Write `test_add_todo_success`
  - Add one todo, verify ID=0, `get_todos` returns 1 item, `completed=false`, text correct

- [ ] **T-116** Write `test_add_todo_increments_id`
  - Add 3 todos in sequence, verify IDs are 0, 1, 2

- [ ] **T-117** Write `test_add_todo_empty_text_fails`
  - Pass empty String → must panic

- [ ] **T-118** Write `test_add_todo_text_too_long_fails`
  - Construct a 257-character String → must panic

- [ ] **T-119** Write `test_toggle_todo_completes`
  - Add todo (completed=false), toggle it, verify completed=true

- [ ] **T-120** Write `test_toggle_todo_uncompletes`
  - Add todo, toggle (→ true), toggle again (→ false), verify completed=false

- [ ] **T-121** Write `test_toggle_todo_not_found_fails`
  - Add todo with ID=0, try to toggle ID=99 → must panic

- [ ] **T-122** Write `test_delete_todo_success`
  - Add 2 todos, delete ID=0, verify `get_todos` returns only 1 (ID=1)

- [ ] **T-123** Write `test_delete_todo_not_found_fails`
  - Add todo, try to delete ID=99 → must panic

- [ ] **T-124** Write `test_delete_last_todo_removes_key`
  - Add 1 todo, delete it, verify `get_todos` returns empty Vec
  - Bonus: verify storage key is gone (no panic on fresh `get_todos`)

- [ ] **T-125** Write `test_get_todos_empty`
  - Fresh address with no todos → `get_todos` returns empty Vec

- [ ] **T-126** Write `test_get_todo_count`
  - Add 3 todos, verify `get_todo_count` returns 3

- [ ] **T-127** Write `test_clear_completed`
  - Add 3 todos, toggle IDs 0 and 1, call `clear_completed`
  - Verify: returns 2, `get_todos` returns 1 item (ID=2), `completed=false`

- [ ] **T-128** Write `test_clear_completed_none`
  - Add 2 todos (neither completed), call `clear_completed`
  - Verify: returns 0, `get_todos` still returns 2 items

- [ ] **T-129** Write `test_isolation_between_wallets`
  - Generate two addresses A and B
  - A adds "Alice's todo", B adds "Bob's todo"
  - `get_todos(A)` contains only Alice's, `get_todos(B)` contains only Bob's

- [ ] **T-130** Write `test_add_after_delete_uses_new_id`
  - Add todo (ID=0), delete it, add another todo
  - Verify new todo has ID=1 (counter is not reset)

- [ ] **T-131** Run all tests: `cargo test`
  - All 16 tests must show `ok`
  - Zero compilation warnings (ideally)

---

## A11 — Deployment Scripts

- [ ] **T-201** Create `scripts/fund-account.sh`
  - Generate deployer key if not exists
  - Call Friendbot API with deployer public key
  - Print confirmation + deployer address
  - `chmod +x scripts/fund-account.sh`

- [ ] **T-202** Create `scripts/deploy.sh`
  - Step 1: `cargo build --target wasm32-unknown-unknown --release`
  - Step 2: `stellar contract optimize --wasm <path>`
  - Step 3: `stellar contract deploy ...` → capture `CONTRACT_ID`
  - Step 4: Write 4 `VITE_*` variables to `frontend/.env` via heredoc
  - Step 5: Print `✅ Contract deployed!` and `CONTRACT_ID`
  - `chmod +x scripts/deploy.sh`

- [ ] **T-203** Create `scripts/invoke-test.sh`
  - Source `frontend/.env` at top
  - Invoke 6 functions: `add_todo` × 2, `get_todos`, `toggle_todo`, `clear_completed`, `get_todos` again
  - Print each result
  - Print `✅ All smoke tests passed` at end
  - `chmod +x scripts/invoke-test.sh`

- [ ] **T-204** Execute: `./scripts/fund-account.sh`
  - Confirm output shows `✅ Funded`

- [ ] **T-205** Execute: `./scripts/deploy.sh`
  - Confirm output shows `✅ Contract deployed!`

- [ ] **T-206** Verify `frontend/.env` manually:
  ```bash
  cat frontend/.env
  ```
  - Must contain `VITE_CONTRACT_ID=C` followed by 55 more alphanumeric chars (56 total)

- [ ] **T-207** Execute: `./scripts/invoke-test.sh`
  - All 6 invocations must succeed
  - Final line must show `✅ All smoke tests passed`

- [ ] **T-208** ✅ **PHASE A GATE — Confirm ALL conditions met:**
  - `cargo test` → all 16 tests `ok`
  - `deploy.sh` → exited 0
  - `frontend/.env` → exists with valid `VITE_CONTRACT_ID`
  - `invoke-test.sh` → exited 0

---

# 🖥 PHASE B — FRONTEND
> Only start after T-208 confirmed. `frontend/.env` must already exist.

---

## B1 — Project Bootstrap

- [ ] **T-301** Initialize Vite React TypeScript project:
  ```bash
  npm create vite@latest frontend -- --template react-ts
  ```
- [ ] **T-302** Install Stellar dependencies:
  ```bash
  cd frontend
  npm install @stellar/stellar-sdk @stellar/freighter-api
  ```
- [ ] **T-303** Install polyfill for Node.js APIs in browser:
  ```bash
  npm install --save-dev vite-plugin-node-polyfills @types/node
  ```
- [ ] **T-304** Configure `vite.config.ts`
  - Add `react()` plugin
  - Add `nodePolyfills({ include: ['buffer', 'crypto', 'stream', 'util'], globals: { Buffer: true, global: true, process: true } })`
  - Add `resolve.alias: { '@': path.resolve(__dirname, './src') }`
- [ ] **T-305** Configure `tsconfig.json`
  - `"strict": true`, `"moduleResolution": "bundler"`, `"target": "ES2020"`
  - Path alias: `"@/*": ["./src/*"]`
- [ ] **T-306** Confirm `frontend/.env` exists from Phase A — if missing: STOP and re-run `deploy.sh`
- [ ] **T-307** Create `frontend/.env.example` with placeholder values
- [ ] **T-308** Run dev server to confirm zero config errors: `npm run dev`

---

## B2 — Types

- [ ] **T-401** Create `frontend/src/types/index.ts`
  - `Todo` interface with all 5 fields
  - `TxStatus` union type (6 states)
  - `TxState` interface with `status`, `txHash`, `error`, `action`
  - `INITIAL_TX_STATE` constant
  - `WalletState` interface

---

## B3 — Library Layer

- [ ] **T-501** Create `frontend/src/lib/wallet.ts`
  - `checkExistingConnection(): Promise<string | null>`
  - `connectFreighter(): Promise<WalletInfo>`
  - `truncateAddress(address: string): string`
  - Re-export `signTransaction` from Freighter

- [ ] **T-502** Create `frontend/src/lib/contract.ts`
  - Initialize `server` and `contract` with env var values
  - Implement `runTx(sourcePublicKey, operation, onStatus)` — full lifecycle helper
  - Implement `readTx<T>(operation)` — simulate-only helper for reads
  - Implement `decodeTodo(raw: unknown): Todo` — XDR map → TypeScript struct

- [ ] **T-503** Implement `contractAddTodo(ownerPublicKey, text, onStatus)`
  - Encode args: Address + String
  - Call `runTx`, return `{ txHash, newId }`

- [ ] **T-504** Implement `contractToggleTodo(ownerPublicKey, todoId, onStatus)`
  - Encode args: Address + u32
  - Call `runTx`, return txHash

- [ ] **T-505** Implement `contractDeleteTodo(ownerPublicKey, todoId, onStatus)`
  - Encode args: Address + u32
  - Call `runTx`, return txHash

- [ ] **T-506** Implement `contractGetTodos(ownerPublicKey)`
  - Encode arg: Address
  - Call `readTx`, decode `Vec<Todo>` via `decodeTodo`
  - Return `Todo[]`

- [ ] **T-507** Implement `contractClearCompleted(ownerPublicKey, onStatus)`
  - Encode arg: Address
  - Call `runTx`, return `{ txHash, removedCount }`

---

## B4 — Context and Hooks

- [ ] **T-601** Create `frontend/src/context/WalletContext.tsx`
  - `WalletContext` typed as `WalletContextType | null`
  - `WalletProvider` component managing wallet state
  - Check existing connection on mount via `checkExistingConnection()`
  - Expose `connect`, `disconnect`, `publicKey`, `isConnected`, `isCorrectNetwork`
  - Export `useWalletContext()` with null-check guard

- [ ] **T-602** Create `frontend/src/hooks/useWallet.ts`
  - Thin wrapper re-exporting `useWalletContext()`

- [ ] **T-603** Create `frontend/src/hooks/useTodos.ts`
  - State: `todos: Todo[]`, `loading: boolean`, `txState: TxState`
  - Fetch todos on mount and when `publicKey` changes via `contractGetTodos`
  - `addTodo(text)`: set `txState.action = "Adding todo"`, call contract, refresh on success
  - `toggleTodo(id)`: set `txState.action = "Toggling todo"`, call contract, refresh on success
  - `deleteTodo(id)`: set `txState.action = "Deleting todo"`, call contract, refresh on success
  - `clearCompleted()`: set `txState.action = "Clearing completed"`, call contract, refresh on success
  - `refresh()`: re-fetch all todos from chain, update loading state
  - On any error: `txState.status = 'failed'`, `txState.error = error.message`
  - Auto-reset `txState` to `INITIAL_TX_STATE` after 4 seconds on success

---

## B5 — Components

- [ ] **T-701** Create `ConnectWallet.tsx`
  - Disconnected: "Connect Freighter" button, spinner while connecting
  - Connected + correct network: truncated public key + "Disconnect" button
  - Connected + wrong network: red warning banner `"⚠️ Switch to Stellar Testnet in Freighter"`
  - Handle install error: "Install Freighter from freighter.app"

- [ ] **T-702** Create `TxStatusBar.tsx`
  - Props: `txState: TxState`
  - Hidden entirely when `status === 'idle'`
  - 6 status states each with icon + message:
    - `building` → ⚙️ `"{action}..."`
    - `awaiting_signature` → ✍️ `"Sign in Freighter..."`
    - `submitting` → 📤 `"Submitting to Stellar..."`
    - `polling` → 🔄 `"Confirming on-chain..."` (spinning class on icon)
    - `success` → ✅ `"Done!"` + clickable short hash → Stellar Expert URL
    - `failed` → ❌ `"Failed: {error}"`
  - Stellar Expert URL: `https://stellar.expert/explorer/testnet/tx/{txHash}`

- [ ] **T-703** Create `TodoInput.tsx`
  - Props: `onAdd: (text: string) => Promise<void>`, `disabled: boolean`
  - Controlled text input with `useState`
  - Placeholder: "What needs to be done?"
  - Submit on Enter key + "Add" button
  - Trim whitespace before calling `onAdd`
  - Clear input after successful add
  - Button + input disabled when `disabled=true` OR `text.trim().length === 0`
  - Show char count `"{n}/256"` when `text.length > 200`
  - Red border on input when `text.length > 256`

- [ ] **T-704** Create `TodoItem.tsx`
  - Props: `todo: Todo`, `onToggle: (id) => Promise<void>`, `onDelete: (id) => Promise<void>`, `disabled: boolean`
  - Layout: `[circle toggle] [text] [× delete]`
  - Toggle circle: filled green circle with ✓ when completed; hollow circle when not
  - Text: line-through + muted color when `completed`; normal when not
  - Delete button: `×` character, right-aligned
  - Both buttons disabled when `disabled=true`
  - Creation date shown in `title` tooltip attribute: `new Date(todo.createdAt * 1000).toLocaleString()`

- [ ] **T-705** Create `TodoList.tsx`
  - Props: `todos`, `onToggle`, `onDelete`, `onClearCompleted`, `loading`, `txInFlight`
  - Loading state: 3 skeleton rows (animated gray bars via `pulse` class)
  - Empty state (not loading, todos.length === 0): "No todos yet. Add one above! ☑"
  - List: map `todos` to `TodoItem` components
  - Footer when `todos.length > 0`:
    - Left: `"{n} item{s} left"` (count of non-completed)
    - Right: "Clear completed" button (hidden when `todos.filter(t=>t.completed).length === 0`)

---

## B6 — App Shell

- [ ] **T-801** Create `frontend/src/main.tsx`
  - React 18 `createRoot` mounting
  - `ErrorBoundary` class component wrapping `<App />`
  - Error state shows error message + "Reload" button

- [ ] **T-802** Create `frontend/src/App.tsx`
  - `WalletProvider` wrapping entire tree
  - Header: `"☑ Stellar Todo"` title (left) + `<ConnectWallet />` (right)
  - Body:
    - `<TxStatusBar txState={txState} />` — always rendered, hides when idle
    - If connected: `<TodoInput />` + `<TodoList />`
    - If not connected: centered message "Connect your Freighter wallet to manage your todos"
  - Max width `600px`, centered, white card with subtle shadow
  - `useTodos` hook called here; props passed down to children

- [ ] **T-803** Create `frontend/src/index.css`
  - CSS reset: `box-sizing: border-box; margin: 0; padding: 0`
  - Body: system font stack, `background: #f5f5f5`, `color: #1a1a1a`
  - `@keyframes spin` and `@keyframes pulse`
  - `.spin { animation: spin 1s linear infinite }`
  - `.pulse { animation: pulse 1.5s ease-in-out infinite }`

- [ ] **T-804** Update `frontend/index.html`
  - `<title>Stellar Todo</title>`
  - Viewport meta tag

---

## B7 — Integration QA

- [ ] **T-901** Run build: `npm run build` — must exit 0 with zero TypeScript errors
- [ ] **T-902** Run dev: `npm run dev` — `localhost:5173` loads with no console errors
- [ ] **T-903** Page shows title "☑ Stellar Todo" and "Connect Freighter" button
- [ ] **T-904** Click "Connect Freighter" → Freighter popup → after approval: truncated key in header
- [ ] **T-905** "What needs to be done?" input field appears
- [ ] **T-906** Add a todo: type "Test on Stellar", click Add (or press Enter)
  - Verify: TxStatusBar cycles through all 5 stages (building → sign → submit → polling → done)
  - Verify: todo appears in list after confirmation
- [ ] **T-907** Add 2 more todos — verify IDs increment correctly
- [ ] **T-908** Click toggle circle on first todo:
  - Verify: TxStatusBar shows "Toggling todo..."
  - Verify: text gets line-through after confirmation
- [ ] **T-909** Click toggle again on same todo — verify line-through removed
- [ ] **T-910** Click × on second todo — verify it disappears from list after confirmation
- [ ] **T-911** Toggle first todo (complete it), then click "Clear completed"
  - Verify: "Clearing completed..." status shown
  - Verify: completed todo removed, remaining todos intact
- [ ] **T-912** Switch Freighter to Mainnet — verify red warning banner appears
  - Verify: Add button/input disabled
- [ ] **T-913** Disconnect wallet — verify todo list disappears, connect prompt shown
- [ ] **T-914** Reconnect — verify todos re-fetch from chain (persistence confirmed)
- [ ] **T-915** Resize browser to 375px — verify all elements usable and readable
- [ ] **T-916** Audit browser DevTools console — zero `console.log` statements

---

## B8 — Documentation

- [ ] **T-1001** Write `README.md`:
  - Project summary and what makes it Web3
  - Storage optimization explanation (Vec-per-wallet vs key-per-todo)
  - Architecture diagram (ASCII):
    ```
    User → Freighter → Soroban RPC → stellar-todo Contract
                                          ↓
                                    TodoList(Address) in persistent storage
                                    TodoCount(Address) in instance storage
    ```
  - Prerequisites: Rust, Stellar CLI, Node 20+, Freighter extension
  - **Phase A instructions:**
    1. `./scripts/fund-account.sh`
    2. `./scripts/deploy.sh`
    3. `./scripts/invoke-test.sh`
  - **Phase B instructions:**
    1. `cd frontend && npm install`
    2. Verify `frontend/.env` exists
    3. `npm run dev`
  - How to run tests: `cd contract && cargo test`
  - Environment variable table
  - Stellar Expert testnet explorer link

- [ ] **T-1002** Add JSDoc to all exported functions in `contract.ts` and `wallet.ts`
- [ ] **T-1003** Add JSDoc to both custom hooks
- [ ] **T-1004** Remove all `console.log` debug statements from frontend
- [ ] **T-1005** Final commit: `feat: complete stellar-todo Web3 dApp with storage optimization`

---

## Task Summary Table

| Phase | Section | Task Range | Count | Description |
|---|---|---|---|---|
| **PHASE A** | A1 Setup | T-001 → T-007 | 7 | Tools + repo init |
| | A2 Scaffold | T-101 → T-103 | 3 | Cargo.toml + skeleton |
| | A3 Data Model | T-104 → T-107 | 4 | Structs, keys, errors |
| | A4–A9 Functions | T-108 → T-113 | 6 | All 6 contract functions |
| | A10 Tests | T-114 → T-131 | 18 | 16 unit tests + run |
| | A11 Deploy | T-201 → T-208 | 8 | Scripts + gate check |
| **PHASE B** | B1 Setup | T-301 → T-308 | 8 | Vite + deps + polyfills |
| | B2 Types | T-401 | 1 | All TypeScript types |
| | B3 Lib Layer | T-501 → T-507 | 7 | wallet.ts + contract.ts |
| | B4 Context+Hooks | T-601 → T-603 | 3 | WalletContext + 2 hooks |
| | B5 Components | T-701 → T-705 | 5 | All 5 components |
| | B6 App Shell | T-801 → T-804 | 4 | main, App, CSS, HTML |
| | B7 QA | T-901 → T-916 | 16 | End-to-end testing |
| | B8 Docs | T-1001 → T-1005 | 5 | README + polish |
| **TOTAL** | | | **95 tasks** | Full project lifecycle |

---

## ✔️ Definition of Done

A task is complete when ALL of the following are true:
1. Code compiles (Rust: no warnings; TypeScript: strict, zero errors)
2. All 16 unit tests pass: `cargo test`
3. Contract is live on Stellar Testnet with ID persisted in `frontend/.env`
4. Feature works end-to-end in browser with real Freighter wallet
5. Zero `console.log` debug statements remain
6. Change committed with a descriptive commit message

---

## 🚦 Phase A Critical Path — Cannot Skip Any Step

```
T-001 → T-005    Install tools
T-101 → T-103    Cargo.toml + verify compile
T-104 → T-107    Data model (types, keys, errors)
T-108             add_todo (most complex function)
T-109             toggle_todo
T-110             delete_todo (with key-removal optimization)
T-111             get_todos
T-112             get_todo_count
T-113             clear_completed (bulk optimization)
T-131             cargo test — all 16 pass
T-201 → T-207    Scripts + deploy + smoke test
T-208             ✅ GATE — confirm CONTRACT_ID in .env
```

## 🚦 Phase B Critical Path — Fastest Working Frontend

```
T-301 → T-308    Bootstrap + polyfills
T-401            Types
T-501 → T-506    wallet.ts + contract.ts (all read/write functions)
T-601 → T-603    WalletContext + useWallet + useTodos
T-701             ConnectWallet (must connect before anything works)
T-702             TxStatusBar (must show before testing mutations)
T-703             TodoInput
T-704             TodoItem
T-705             TodoList
T-801 → T-804    App shell + CSS + HTML
T-901 → T-911    Core QA (add → toggle → delete → clear)
```

Then return for T-912–T-916 (edge cases), T-1001–T-1005 (docs).
