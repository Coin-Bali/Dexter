"use client";
import { LoadingSkeleton } from "@coinbase/cdp-react/components/LoadingSkeleton";
import Image from "next/image"
interface Props {
  balance?: string;
}

/**
 * A component that displays the user's balance.
 *
 * @param {Props} props - The props for the UserBalance component.
 * @param {string} [props.balance] - The user's balance.
 * @returns A component that displays the user's balance.
 */
export default function UserBalance(props: Props) {
  const { balance } = props;
  return (
    <>
      <h2 className="card-title">Available balance</h2>
      <p className="user-balance flex-col-container flex-grow">
        {balance === undefined && <LoadingSkeleton as="span" className="loading--balance" />}
        {balance !== undefined && (
          <span className="flex-row-container">
            <Image src="/eth.svg" alt="eth logo" width={16} height={16} className="balance-icon" />
            <span>{balance}</span>
            <span className="sr-only">Ethereum</span>
          </span>
        )}
      </p>
      <p>
        Get testnet ETH from{" "}
        <a
          href="https://portal.cdp.coinbase.com/products/faucet"
          target="_blank"
          rel="noopener noreferrer"
        >
          Base Sepolia Faucet
        </a>
      </p>
    </>
  );
}
