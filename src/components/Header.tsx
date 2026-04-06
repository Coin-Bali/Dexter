"use client";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";
import { useEffect, useState } from "react";

import { IconCheck, IconCopy, IconUser } from "@/components/Icons";
import { PRODUCT_NAME } from "@/lib/branding";

/**
 * Header component
 */
export default function Header() {
  const { evmAddress } = useEvmAddress();
  const [isCopied, setIsCopied] = useState(false);

  const copyAddress = async () => {
    if (!evmAddress) return;
    try {
      await navigator.clipboard.writeText(evmAddress);
      setIsCopied(true);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, [isCopied]);

  return (
    <header>
      <div className="header-inner">
        <div className="header-brand">
          <h1 className="site-title">{PRODUCT_NAME}</h1>
          <p className="site-subtitle">CDP-native machine commerce platform</p>
        </div>
        <div className="user-info flex-row-container">
          {evmAddress && (
            <button
              aria-label="copy wallet address"
              className="flex-row-container copy-address-button"
              onClick={copyAddress}
            >
              {!isCopied && (
                <>
                  <IconUser className="user-icon user-icon--user" />
                  <IconCopy className="user-icon user-icon--copy" />
                </>
              )}
              {isCopied && <IconCheck className="user-icon user-icon--check" />}
              <span className="wallet-address">
                {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
              </span>
            </button>
          )}
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
