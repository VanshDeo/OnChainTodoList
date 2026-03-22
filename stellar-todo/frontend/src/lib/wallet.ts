import { isAllowed, setAllowed, requestAccess } from "@stellar/freighter-api";

export async function connectWallet(): Promise<string> {
  const allowed = await isAllowed();
  if (typeof allowed === 'object' && !allowed.isAllowed) {
    await setAllowed();
  } else if (typeof allowed === 'boolean' && !allowed) {
    await setAllowed();
  }
  
  const access = await requestAccess();
  if (access.error) {
    throw new Error(access.error);
  }
  
  return access.address;
}
