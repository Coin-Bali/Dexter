import { useEvmAddress, useIsSignedIn } from "@coinbase/cdp-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPublicClient, http, formatEther, createWalletClient, custom } from "viem";
import { baseSepolia } from "viem/chains";

import Header from "@/components/Header";
import OnRampOffRamp from "@/components/OnRampOffRamp";
import PriceChart from './PriceChart';
import Transaction from "@/components/Transaction";
import UserBalance from "@/components/UserBalance";
import TradingActions from "@/components/TradingActions";

/**
 * Create a viem client to access user's balance on the Base Sepolia network
 */
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

/**
 * Create a viem wallet client for signing transactions
 */
// const walletClient = typeof window !== 'undefined' && window.ethereum
//   ? createWalletClient({
//       chain: baseSepolia,
//       transport: custom(window.ethereum),
//     })
//   : undefined;

// interface Trade {
//   direction: 'up' | 'down';
//   initialPrice: number;
//   amount: number;
//   startTime: number;
// }

/**
 * The Signed In screen
 */
export default function SignedInScreen() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const [balance, setBalance] = useState<bigint | undefined>(undefined);

  const formattedBalance = useMemo(() => {
    if (balance === undefined) return undefined;
    return formatEther(balance);
  }, [balance]);

  const getBalance = useCallback(async () => {
    if (!evmAddress) return;
    const balance = await client.getBalance({
      address: evmAddress,
    });
    setBalance(balance);
  }, [evmAddress]);

  useEffect(() => {
    getBalance();
    const interval = setInterval(getBalance, 500);
    return () => clearInterval(interval);
  }, [getBalance]);

  return (
    <>
      <Header />
      <main className="main flex flex-col p-4 gap-4">
        <div className="w-full">
          <PriceChart />
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }} className="w-full flex flex-row flex-wrap justify-center gap-4">
        <TradingActions evmAddress={evmAddress} getBalance={getBalance} />
          <div className="card card--user-balance max-w-sm">
            <UserBalance balance={formattedBalance} />
          </div>
          <div className="card card--onramp-offramp max-w-sm">
            <OnRampOffRamp
              // balance={formattedBalance}
              // getBalance={getBalance}
              evmAddress={evmAddress}
            />
          </div>
          <div className="card card--transaction max-w-sm">
            {isSignedIn && evmAddress && (
              <Transaction balance={formattedBalance} onSuccess={getBalance} />
            )}
          </div>
        </div>
      </main>
    </>
  );
}