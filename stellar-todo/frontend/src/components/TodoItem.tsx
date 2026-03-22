import { Todo } from "../types";
import { Trash2, Check, Clock } from "lucide-react";

export function TodoItem({
  todo,
  onToggle,
  onDelete,
  disabled
}: {
  todo: Todo;
  onToggle: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  disabled: boolean;
}) {
  const dateStr = new Date(todo.created_at * 1000).toLocaleDateString();

  return (
    <div 
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px",
        background: "#fff",
        borderBottom: "1px solid #f3f4f6",
        opacity: disabled ? 0.6 : 1,
        transition: "opacity 0.2s"
      }}
    >
      <div 
        style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1 }}
      >
        <button
          onClick={() => onToggle(todo.id)}
          disabled={disabled}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            border: todo.completed ? "none" : "2px solid #d1d5db",
            background: todo.completed ? "#10b981" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff"
          }}
        >
          {todo.completed && <Check size={14} strokeWidth={3} />}
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span
            style={{
              fontSize: "16px",
              color: todo.completed ? "#9ca3af" : "#111827",
              textDecoration: todo.completed ? "line-through" : "none",
              fontWeight: 500
            }}
          >
            {todo.text}
          </span>
          <div 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "4px", 
              color: "#9ca3af", 
              fontSize: "12px" 
            }}
          >
            <Clock size={12} />
            {dateStr}
          </div>
        </div>
      </div>
      
      <button
        onClick={() => onDelete(todo.id)}
        disabled={disabled}
        style={{
          color: "#ef4444",
          opacity: disabled ? 0.5 : 1,
          padding: "8px"
        }}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
