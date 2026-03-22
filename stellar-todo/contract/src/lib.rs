#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    panic_with_error, Address, Env, String, Vec,
};

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
    TodoNotFound = 1,
    TextTooLong = 2,
    EmptyText = 3,
    AlreadyCompleted = 4,
    AlreadyIncomplete = 5,
    ListEmpty = 6,
}

#[contract]
pub struct TodoContract;

#[contractimpl]
impl TodoContract {
    // ── ADD TODO ──────────────────────────────────────────────────────────────
    // owner: the wallet creating the todo — must authorize
    // text: the todo text — must be 1–256 chars
    // Returns the new todo's ID
    pub fn add_todo(env: Env, owner: Address, text: String) -> Result<u32, TodoError> {
        owner.require_auth();
        let text_len = text.len();
        if text_len == 0 {
            return Err(TodoError::EmptyText);
        }
        if text_len > 256 {
            return Err(TodoError::TextTooLong);
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
        Ok(new_id)
    }

    // ── TOGGLE COMPLETE ───────────────────────────────────────────────────────
    // Flips the completed state of a todo.
    // owner: must authorize
    // todo_id: the ID of the todo to toggle
    pub fn toggle_todo(env: Env, owner: Address, todo_id: u32) -> Result<(), TodoError> {
        owner.require_auth();
        let mut todos: Vec<Todo> = env
            .storage()
            .persistent()
            .get(&DataKey::TodoList(owner.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        if todos.is_empty() {
            return Err(TodoError::ListEmpty);
        }
        let mut found = false;
        let now = env.ledger().timestamp();
        let mut updated: Vec<Todo> = Vec::new(&env);
        for i in 0..todos.len() {
            let mut todo = todos.get(i).unwrap();
            if todo.id == todo_id {
                todo.completed = !todo.completed;
                todo.updated_at = now;
                found = true;
            }
            updated.push_back(todo);
        }
        if !found {
            return Err(TodoError::TodoNotFound);
        }
        env.storage()
            .persistent()
            .set(&DataKey::TodoList(owner.clone()), &updated);
        Ok(())
    }

    // ── DELETE TODO ───────────────────────────────────────────────────────────
    // Removes a todo permanently. IDs are never reused.
    // owner: must authorize
    // todo_id: the ID of the todo to remove
    pub fn delete_todo(env: Env, owner: Address, todo_id: u32) -> Result<(), TodoError> {
        owner.require_auth();
        let todos: Vec<Todo> = env
            .storage()
            .persistent()
            .get(&DataKey::TodoList(owner.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        if todos.is_empty() {
            return Err(TodoError::ListEmpty);
        }
        let original_len = todos.len();
        let mut updated: Vec<Todo> = Vec::new(&env);
        for i in 0..todos.len() {
            let todo = todos.get(i).unwrap();
            if todo.id != todo_id {
                updated.push_back(todo);
            }
        }
        if updated.len() == original_len {
            return Err(TodoError::TodoNotFound);
        }
        if updated.is_empty() {
            env.storage()
                .persistent()
                .remove(&DataKey::TodoList(owner.clone()));
        } else {
            env.storage()
                .persistent()
                .set(&DataKey::TodoList(owner.clone()), &updated);
        }
        Ok(())
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
    // Returns the number of todos that were removed
    pub fn clear_completed(env: Env, owner: Address) -> Result<u32, TodoError> {
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
        Ok(removed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup<'a>(env: &'a Env) -> (Address, TodoContractClient<'a>) {
        env.mock_all_auths();
        let contract_id = env.register_contract(None, TodoContract);
        let client = TodoContractClient::new(env, &contract_id);
        let user = Address::generate(env);
        (user, client)
    }

    #[test]
    fn test_add_todo_success() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let text = String::from_str(&env, "Buy milk");
        let id = client.add_todo(&user, &text);
        assert_eq!(id, 0);

        let todos = client.get_todos(&user);
        assert_eq!(todos.len(), 1);
        let todo = todos.get(0).unwrap();
        assert_eq!(todo.id, 0);
        assert_eq!(todo.text, text);
        assert_eq!(todo.completed, false);
    }

    #[test]
    fn test_add_todo_increments_id() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let id1 = client.add_todo(&user, &String::from_str(&env, "A"));
        let id2 = client.add_todo(&user, &String::from_str(&env, "B"));
        let id3 = client.add_todo(&user, &String::from_str(&env, "C"));
        assert_eq!(id1, 0);
        assert_eq!(id2, 1);
        assert_eq!(id3, 2);
    }

    #[test]
    fn test_add_todo_empty_text_fails() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let res = client.try_add_todo(&user, &String::from_str(&env, ""));
        assert!(res.is_err());
    }

    #[test]
    fn test_add_todo_text_too_long_fails() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let text = String::from_str(&env, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        let res = client.try_add_todo(&user, &text);
        assert!(res.is_err());
    }

    #[test]
    fn test_toggle_todo_completes() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let id = client.add_todo(&user, &String::from_str(&env, "Toggle me"));
        client.toggle_todo(&user, &id);
        let todos = client.get_todos(&user);
        assert_eq!(todos.get(0).unwrap().completed, true);
    }

    #[test]
    fn test_toggle_todo_uncompletes() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let id = client.add_todo(&user, &String::from_str(&env, "Toggle me"));
        client.toggle_todo(&user, &id);
        client.toggle_todo(&user, &id);
        let todos = client.get_todos(&user);
        assert_eq!(todos.get(0).unwrap().completed, false);
    }

    #[test]
    fn test_toggle_todo_not_found_fails() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let res = client.try_toggle_todo(&user, &99);
        assert!(res.is_err());
    }

    #[test]
    fn test_delete_todo_success() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let id1 = client.add_todo(&user, &String::from_str(&env, "A"));
        let id2 = client.add_todo(&user, &String::from_str(&env, "B"));
        client.delete_todo(&user, &id1);
        let todos = client.get_todos(&user);
        assert_eq!(todos.len(), 1);
        assert_eq!(todos.get(0).unwrap().id, id2);
    }

    #[test]
    fn test_delete_todo_not_found_fails() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let res = client.try_delete_todo(&user, &0);
        assert!(res.is_err());
    }

    #[test]
    fn test_delete_last_todo_removes_key() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let id = client.add_todo(&user, &String::from_str(&env, "A"));
        client.delete_todo(&user, &id);
        let todos = client.get_todos(&user);
        assert_eq!(todos.len(), 0);
    }

    #[test]
    fn test_get_todos_empty() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let todos = client.get_todos(&user);
        assert_eq!(todos.len(), 0);
    }

    #[test]
    fn test_get_todo_count() {
        let env = Env::default();
        let (user, client) = setup(&env);
        client.add_todo(&user, &String::from_str(&env, "A"));
        client.add_todo(&user, &String::from_str(&env, "B"));
        client.add_todo(&user, &String::from_str(&env, "C"));
        let count = client.get_todo_count(&user);
        assert_eq!(count, 3);
    }

    #[test]
    fn test_clear_completed() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let id1 = client.add_todo(&user, &String::from_str(&env, "A"));
        let id2 = client.add_todo(&user, &String::from_str(&env, "B"));
        let id3 = client.add_todo(&user, &String::from_str(&env, "C"));
        client.toggle_todo(&user, &id1);
        client.toggle_todo(&user, &id3);
        
        let removed = client.clear_completed(&user);
        assert_eq!(removed, 2);
        
        let todos = client.get_todos(&user);
        assert_eq!(todos.len(), 1);
        assert_eq!(todos.get(0).unwrap().id, id2);
    }

    #[test]
    fn test_clear_completed_none() {
        let env = Env::default();
        let (user, client) = setup(&env);
        client.add_todo(&user, &String::from_str(&env, "A"));
        let removed = client.clear_completed(&user);
        assert_eq!(removed, 0);
        assert_eq!(client.get_todos(&user).len(), 1);
    }

    #[test]
    fn test_isolation_between_wallets() {
        let env = Env::default();
        let (user1, client1) = setup(&env);
        let user2 = Address::generate(&env);
        let client2 = TodoContractClient::new(&env, &client1.address);
        
        client1.add_todo(&user1, &String::from_str(&env, "A"));
        client2.add_todo(&user2, &String::from_str(&env, "B"));

        assert_eq!(client1.get_todos(&user1).len(), 1);
        assert_eq!(client2.get_todos(&user2).len(), 1);
        assert_eq!(client1.get_todos(&user1).get(0).unwrap().text, String::from_str(&env, "A"));
        assert_eq!(client2.get_todos(&user2).get(0).unwrap().text, String::from_str(&env, "B"));
    }

    #[test]
    fn test_add_after_delete_uses_new_id() {
        let env = Env::default();
        let (user, client) = setup(&env);
        let id1 = client.add_todo(&user, &String::from_str(&env, "A"));
        client.delete_todo(&user, &id1);
        let id2 = client.add_todo(&user, &String::from_str(&env, "B"));
        assert_eq!(id1, 0);
        assert_eq!(id2, 1);
    }
}
