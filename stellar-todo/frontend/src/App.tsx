import { useEffect } from "react";
import { WalletProvider } from "./context/WalletContext";
import { useWallet } from "./hooks/useWallet";
import { useTodos } from "./hooks/useTodos";
import { ConnectWallet } from "./components/ConnectWallet";
import { TxStatusBar } from "./components/TxStatusBar";
import { TodoInput } from "./components/TodoInput";
import { TodoList } from "./components/TodoList";
import { CheckSquare } from "lucide-react";

function TodoApp() {
  const { pubKey } = useWallet();
  const {
    todos,
    loading,
    txState,
    refreshTodos,
    onAddTodo,
    onToggleTodo,
    onDelete,
    onClearCompleted,
    txInFlight
  } = useTodos();

  useEffect(() => {
    if (pubKey) {
      refreshTodos();
    }
  }, [pubKey, refreshTodos]);

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "40px 20px" }}>
      <header 
        style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "32px"
        }}
      >
        <h1 style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "24px", color: "#111827" }}>
          <CheckSquare size={28} color="#4f46e5" />
          Stellar Todo
        </h1>
        <ConnectWallet />
      </header>

      {txState !== "idle" && (
        <TxStatusBar state={txState} />
      )}

      {pubKey ? (
        <main>
          <TodoInput onAddTodo={onAddTodo} disabled={txInFlight} />
          <TodoList
            todos={todos}
            loading={loading}
            txInFlight={txInFlight}
            onToggle={onToggleTodo}
            onDelete={onDelete}
            onClearCompleted={onClearCompleted}
          />
        </main>
      ) : (
        <div style={{ 
          textAlign: "center", 
          padding: "64px 20px", 
          background: "#fff", 
          borderRadius: "12px",
          color: "#4b5563" 
        }}>
          <h2>Welcome!</h2>
          <p style={{ marginTop: "8px", color: "#6b7280" }}>
            Connect your Freighter wallet to manage your on-chain todos.
          </p>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <TodoApp />
    </WalletProvider>
  );
}
