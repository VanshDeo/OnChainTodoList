import { TxState } from "../types";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export function TxStatusBar({ state }: { state: TxState }) {
  if (state === "idle") return null;

  let bg = "#f3f4f6";
  let color = "#374151";
  let msg = "Processing...";
  let Icon = Loader2;

  if (state === "signing") {
    bg = "#e0e7ff";
    color = "#4338ca";
    msg = "Please sign the transaction in your Freighter wallet...";
  } else if (state === "submitting") {
    bg = "#fef3c7";
    color = "#b45309";
    msg = "Submitting transaction to the Stellar Testnet... (this takes ~5s)";
  } else if (state === "success") {
    bg = "#dcfce3";
    color = "#15803d";
    msg = "Transaction successful!";
    Icon = CheckCircle;
  } else if (state === "error") {
    bg = "#fee2e2";
    color = "#b91c1c";
    msg = "Transaction failed!";
    Icon = XCircle;
  }

  return (
    <div 
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: bg,
        color: color,
        padding: "12px 16px",
        borderRadius: "8px",
        marginBottom: "24px",
        fontSize: "14px",
        fontWeight: 500
      }}
    >
      {state === "signing" || state === "submitting" ? (
        <Icon size={18} className="spin" />
      ) : (
        <Icon size={18} />
      )}
      {msg}
    </div>
  );
}
