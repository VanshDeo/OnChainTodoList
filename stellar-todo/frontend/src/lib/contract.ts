import { Contract, rpc, TransactionBuilder, TimeoutInfinite } from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { TxState } from "../types";

const rpcUrl = import.meta.env.VITE_RPC_URL;
const networkPassphrase = import.meta.env.VITE_NETWORK_PASSPHRASE;
const contractId = import.meta.env.VITE_CONTRACT_ID;

export const server = new rpc.Server(rpcUrl);
export const contract = new Contract(contractId);

console.log("Stellar Todo dApp Initialized");
console.log("Contract ID:", contractId);
console.log("RPC URL:", rpcUrl);
console.log("Network:", networkPassphrase);

export async function submitTx(
  publicKey: string,
  method: string,
  args: any[] = [],
  setTxState?: (state: TxState) => void
): Promise<any> {
  try {
    setTxState?.("signing");
    const account = await server.getAccount(publicKey);
    const tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase })
      .addOperation(contract.call(method, ...args))
      .setTimeout(TimeoutInfinite)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    const signedXdr = await signTransaction(preparedTx.toXDR(), { networkPassphrase });

    const xdrString = typeof signedXdr === 'string' ? signedXdr : signedXdr.signedTxXdr;
    if (!xdrString) {
      throw new Error("Failed to sign transaction. Make sure you have the correct account selected in Freighter.");
    }
    const signedTx = TransactionBuilder.fromXDR(xdrString, networkPassphrase) as any;
    
    setTxState?.("submitting");
    const sendRes = await server.sendTransaction(signedTx);

    if (sendRes.status === "PENDING") {
      let status = "PENDING";
      let res: any;
      while (status === "PENDING") {
        await new Promise((r) => setTimeout(r, 2000));
        res = await server.getTransaction(sendRes.hash);
        status = res.status;
      }
      if (status === "SUCCESS") {
        setTxState?.("success");
        return res.returnValue;
      }
      throw new Error(`Tx failed: ${status}`);
    }
    throw new Error(`Tx failed directly: ${sendRes.status}`);
  } catch (error: any) {
    setTxState?.("error");
    console.error("Submission error:", error);
    // Alert the user to fundamental issues like unfunded accounts
    if (error.message?.includes("404")) {
      alert("Account not found! Please fund your Testnet account using a Friendbot tool.");
    } else if (error.message?.includes("rejected")) {
      // User rejected signing, no alert needed but reset state
    } else {
      alert(`Transaction failed: ${error.message || "Unknown error"}`);
    }
    throw error;
  }
}

export async function simulateTx(
  method: string,
  args: any[] = []
): Promise<any> {
  // Using a zero address for simple view calls
  const source = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const account = await server.getAccount(source).catch(() => {
    // If account doesn't exist, we just mock one for simulation
    return {
      accountId: () => source,
      sequenceNumber: () => "0",
      incrementSequenceNumber: () => {},
    } as any;
  });
  
  const tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase })
    .addOperation(contract.call(method, ...args))
    .setTimeout(TimeoutInfinite)
    .build();

  try {
    const res = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(res) && res.result) {
      return res.result.retval;
    }
    throw new Error("Simulation failed - the contract function might have trapped.");
  } catch (error: any) {
    if (error.message?.includes("404")) {
      console.error("Contract not found on network! ID:", contractId);
    }
    throw error;
  }
}
