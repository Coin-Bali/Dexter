"use client";

import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";
import Image from "next/image";

import { PRODUCT_NAME } from "@/lib/branding";

/**
 * Sign in screen
 */
export default function SignInScreen() {
  return (
    <main className="card sign-in-card">
      <h1 className="sr-only">Sign in</h1>
      <Image className="auth-logo" src="/logo.svg" alt={`${PRODUCT_NAME} logo`} width={72} height={72} />
      <p className="eyebrow">Coinbase Developer Platform</p>
      <p className="card-title">Launch {PRODUCT_NAME}</p>
      <p>
        Sign in with an embedded wallet to access your authenticated workspace,
        your agent wallet, x402 services, and AI-powered API creation tools.
      </p>
      <AuthButton />
    </main>
  );
}
