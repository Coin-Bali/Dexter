import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@coinbase/agentkit",
    "@x402/evm",
    "@x402/fetch",
    "viem",
    "@noble/curves",
    "@noble/hashes",
  ],
};

export default nextConfig;
