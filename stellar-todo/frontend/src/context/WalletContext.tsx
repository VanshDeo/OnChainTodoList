import { createContext, useState, ReactNode } from "react";
import { connectWallet } from "../lib/wallet";

interface WalletContextType {
  pubKey: string | null;
  connect: () => Promise<void>;
  loading: boolean;
}

export const WalletContext = createContext<WalletContextType>({
  pubKey: null,
  connect: async () => {},
  loading: false,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const connect = async () => {
    try {
      setLoading(true);
      const key = await connectWallet();
      setPubKey(key);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WalletContext.Provider value={{ pubKey, connect, loading }}>
      {children}
    </WalletContext.Provider>
  );
}
