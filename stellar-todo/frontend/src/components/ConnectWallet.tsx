import { useWallet } from "../hooks/useWallet";
import { Wallet } from "lucide-react";

export function ConnectWallet() {
  const { pubKey, connect, loading } = useWallet();

  if (pubKey) {
    return (
      <div 
        style={{ 
          background: "#e5e7eb", 
          padding: "6px 12px", 
          borderRadius: "16px",
          fontSize: "14px",
          fontWeight: 500
        }}
        title={pubKey}
      >
        {pubKey.slice(0, 4)}...{pubKey.slice(-4)}
      </div>
    );
  }

  return (
    <button 
      onClick={connect} 
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        background: "#000",
        color: "#fff",
        padding: "8px 16px",
        borderRadius: "8px",
        fontWeight: 500,
        opacity: loading ? 0.7 : 1
      }}
    >
      <Wallet size={18} />
      {loading ? "Connecting..." : "Connect Freighter"}
    </button>
  );
}
