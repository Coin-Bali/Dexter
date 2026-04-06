import crypto from "node:crypto";

import { recoverMessageAddress } from "viem";

import { PRODUCT_NAME } from "@/lib/branding";

export const SESSION_COOKIE_NAME = "agent_bazaar_session";
export const AUTH_NONCE_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeWalletAddress(address: string) {
  return address.trim().toLowerCase();
}

export function createNonce() {
  return crypto.randomBytes(16).toString("hex");
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildWalletAuthMessage(walletAddress: string, nonce: string) {
  return [
    `${PRODUCT_NAME} authentication`,
    "",
    "Sign this message to verify that you control this wallet and start a secure session.",
    "",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}

export function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return undefined;
  }

  const cookie = cookieHeader
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));

  return cookie?.slice(name.length + 1);
}

export async function verifyWalletSignature(options: {
  walletAddress: string;
  nonce: string;
  signature: `0x${string}`;
}) {
  const expectedMessage = buildWalletAuthMessage(options.walletAddress, options.nonce);
  const recoveredAddress = await recoverMessageAddress({
    message: expectedMessage,
    signature: options.signature,
  });

  return normalizeWalletAddress(recoveredAddress) === normalizeWalletAddress(options.walletAddress);
}
