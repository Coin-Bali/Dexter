"use client";

import { useEvmAddress, useSignEvmMessage } from "@coinbase/cdp-hooks";
import { useState } from "react";

import { PRODUCT_NAME } from "@/lib/branding";

export default function AuthenticateWalletScreen({
  onAuthenticated,
}: {
  onAuthenticated: () => Promise<void>;
}) {
  const { evmAddress } = useEvmAddress();
  const { signEvmMessage } = useSignEvmMessage();
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleAuthenticate = async () => {
    if (!evmAddress) {
      setError("Wallet address is not available yet.");
      setStatus("error");
      return;
    }

    setStatus("working");
    setError(null);

    try {
      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: evmAddress }),
      });
      const challengePayload = await challengeResponse.json();

      if (!challengeResponse.ok) {
        throw new Error(challengePayload.error ?? "Failed to create sign-in challenge.");
      }

      const signatureResult = await signEvmMessage({
        evmAccount: evmAddress as `0x${string}`,
        message: challengePayload.message,
      });

      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: evmAddress,
          signature: signatureResult.signature,
        }),
      });
      const verifyPayload = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyPayload.error ?? "Failed to verify wallet signature.");
      }

      await onAuthenticated();
      setStatus("idle");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Authentication failed.");
      setStatus("error");
    }
  };

  return (
    <main className="card sign-in-card">
      <h1 className="sr-only">Authenticate wallet</h1>
      <p className="eyebrow">Secure Sign-In</p>
      <p className="card-title">Verify your wallet to continue</p>
      <p>
        {PRODUCT_NAME} uses a wallet signature to protect your saved data, agent wallet,
        compositions, and other non-x402 APIs from abuse.
      </p>
      {evmAddress && (
        <p className="panel-copy" style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
          {evmAddress}
        </p>
      )}
      {error && <div className="inline-error">{error}</div>}
      <button className="primary-button" disabled={status === "working"} onClick={handleAuthenticate} type="button">
        {status === "working" ? "Waiting for signature..." : "Sign message to continue"}
      </button>
    </main>
  );
}
