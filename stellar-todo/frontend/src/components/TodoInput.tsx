import { useState } from "react";
import { Plus } from "lucide-react";

export function TodoInput({ 
  onAddTodo, 
  disabled 
}: { 
  onAddTodo: (text: string) => Promise<void>; 
  disabled: boolean 
}) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && text.length <= 256 && !disabled) {
      onAddTodo(text.trim());
      setText("");
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: "8px",
        marginBottom: "24px"
      }}
    >
      <input
        type="text"
        placeholder="What needs to be done?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        maxLength={256}
        style={{
          flex: 1,
          padding: "12px 16px",
          borderRadius: "8px",
          border: "1px solid #d1d5db",
          outline: "none"
        }}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        style={{
          background: "#000",
          color: "#fff",
          padding: "0 24px",
          borderRadius: "8px",
          opacity: disabled || !text.trim() ? 0.5 : 1,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: 600
        }}
      >
        <Plus size={18} />
        Add
      </button>
    </form>
  );
}
