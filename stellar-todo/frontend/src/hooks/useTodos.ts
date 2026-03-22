import { useState, useCallback } from "react";
import { nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import { submitTx, simulateTx } from "../lib/contract";
import { Todo, TxState } from "../types";
import { useWallet } from "./useWallet";

export function useTodos() {
  const { pubKey } = useWallet();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [txState, setTxState] = useState<TxState>("idle");

  const refreshTodos = useCallback(async () => {
    if (!pubKey) return;
    try {
      setLoading(true);
      const ownerVal = nativeToScVal(pubKey, { type: "address" });
      const resVal = await simulateTx("get_todos", [ownerVal]);
      if (resVal) {
        const parsed = scValToNative(resVal as xdr.ScVal);
        // parsed should be an array of objects
        setTodos(
          parsed.map((item: any) => ({
            id: Number(item.id),
            text: String(item.text),
            completed: Boolean(item.completed),
            created_at: Number(item.created_at),
            updated_at: Number(item.updated_at),
          }))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [pubKey]);

  const onAddTodo = async (text: string) => {
    if (!pubKey) return;
    try {
      await submitTx(
        pubKey,
        "add_todo",
        [
          nativeToScVal(pubKey, { type: "address" }),
          nativeToScVal(text),
        ],
        setTxState
      );
      await refreshTodos();
      setTimeout(() => setTxState("idle"), 2000);
    } catch (e) {
      console.error(e);
      setTimeout(() => setTxState("idle"), 3000);
    }
  };

  const onToggleTodo = async (id: number) => {
    if (!pubKey) return;
    try {
      await submitTx(
        pubKey,
        "toggle_todo",
        [
          nativeToScVal(pubKey, { type: "address" }),
          nativeToScVal(id, { type: "u32" }),
        ],
        setTxState
      );
      await refreshTodos();
      setTimeout(() => setTxState("idle"), 2000);
    } catch (e) {
      console.error(e);
      setTimeout(() => setTxState("idle"), 3000);
    }
  };

  const onDelete = async (id: number) => {
    if (!pubKey) return;
    try {
      await submitTx(
        pubKey,
        "delete_todo",
        [
          nativeToScVal(pubKey, { type: "address" }),
          nativeToScVal(id, { type: "u32" }),
        ],
        setTxState
      );
      await refreshTodos();
      setTimeout(() => setTxState("idle"), 2000);
    } catch (e) {
      console.error(e);
      setTimeout(() => setTxState("idle"), 3000);
    }
  };

  const onClearCompleted = async () => {
    if (!pubKey) return;
    try {
      await submitTx(
        pubKey,
        "clear_completed",
        [nativeToScVal(pubKey, { type: "address" })],
        setTxState
      );
      await refreshTodos();
      setTimeout(() => setTxState("idle"), 2000);
    } catch (e) {
      console.error(e);
      setTimeout(() => setTxState("idle"), 3000);
    }
  };

  return {
    todos,
    loading,
    txState,
    refreshTodos,
    onAddTodo,
    onToggleTodo,
    onDelete,
    onClearCompleted,
    txInFlight: txState !== "idle" && txState !== "success" && txState !== "error",
  };
}
