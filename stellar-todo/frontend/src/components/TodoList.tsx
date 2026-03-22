import { Todo } from "../types";
import { TodoItem } from "./TodoItem";

export function TodoList({
  todos,
  onToggle,
  onDelete,
  onClearCompleted,
  loading,
  txInFlight
}: {
  todos: Todo[];
  onToggle: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onClearCompleted: () => Promise<void>;
  loading: boolean;
  txInFlight: boolean;
}) {
  if (loading) {
    return (
      <div style={{ background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ padding: "16px", borderBottom: "1px solid #f3f4f6" }}>
            <div className="pulse" style={{ height: "24px", background: "#e5e7eb", borderRadius: "4px", width: "60%" }} />
          </div>
        ))}
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div style={{ 
        padding: "48px 0", 
        textAlign: "center", 
        color: "#6b7280",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        No todos yet. Add one above!
      </div>
    );
  }

  const activeCount = todos.filter(t => !t.completed).length;
  const hasCompleted = todos.length - activeCount > 0;

  return (
    <div style={{ background: "#fff", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
          disabled={txInFlight}
        />
      ))}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px",
          background: "#fafafa",
          color: "#6b7280",
          fontSize: "14px"
        }}
      >
        <span>{activeCount} item{activeCount !== 1 ? "s" : ""} left</span>
        {hasCompleted && (
          <button
            onClick={onClearCompleted}
            disabled={txInFlight}
            style={{
              color: "#374151",
              textDecoration: "underline",
              opacity: txInFlight ? 0.5 : 1
            }}
          >
            Clear completed
          </button>
        )}
      </div>
    </div>
  );
}
