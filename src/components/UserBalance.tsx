"use client";

import Image from "next/image";

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
        {balance === undefined && <span className="loading--balance loading-placeholder" />}
        {balance !== undefined && (
          <span className="flex-row-container">
            <Image src="/eth.svg" alt="eth logo" width={16} height={16} className="balance-icon" />
            <span>{balance}</span>
            <span className="sr-only">Ethereum</span>
          </span>
        )}
      </p>
      <p>Fund this wallet on Base using the On/Off-Ramp tab or an external transfer.</p>
    </>
  );
}
