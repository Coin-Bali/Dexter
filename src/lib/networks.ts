import { type Chain } from "viem";
import { base, baseSepolia } from "viem/chains";

export type SupportedNetworkKey = "base-sepolia" | "base";
export type PreferredNetworkValue = "base_sepolia" | "base";
export const PREFERRED_NETWORK_COOKIE_NAME = "agent_bazaar_network";

export type SupportedToken = {
  symbol: string;
  name: string;
  decimals: number;
  address?: `0x${string}`;
  isNative?: boolean;
};

export type SupportedNetwork = {
  key: SupportedNetworkKey;
  preferenceValue: PreferredNetworkValue;
  label: string;
  cdpNetworkId: "base-sepolia" | "base";
  x402Network: "eip155:84532" | "eip155:8453";
  chainId: 84532 | 8453;
  viemChain: Chain;
  explorerBaseUrl: string;
  onrampDefaultNetwork: "base";
  tokens: SupportedToken[];
};

const BASE_SEPOLIA_TOKENS: SupportedToken[] = [
  { symbol: "ETH", name: "Ether", decimals: 18, isNative: true },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    address: "0x4200000000000000000000000000000000000006",
  },
  {
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
    address: "0x808456652fdb597867f38412077A9182bf77359F",
  },
];

const BASE_TOKENS: SupportedToken[] = [
  { symbol: "ETH", name: "Ether", decimals: 18, isNative: true },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    address: "0x4200000000000000000000000000000000000006",
  },
  {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    decimals: 8,
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
  },
  {
    symbol: "EURC",
    name: "Euro Coin",
    decimals: 6,
    address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42",
  },
];

export const SUPPORTED_NETWORKS: Record<SupportedNetworkKey, SupportedNetwork> = {
  "base-sepolia": {
    key: "base-sepolia",
    preferenceValue: "base_sepolia",
    label: "Base Sepolia",
    cdpNetworkId: "base-sepolia",
    x402Network: "eip155:84532",
    chainId: 84532,
    viemChain: baseSepolia,
    explorerBaseUrl: "https://sepolia.basescan.org",
    onrampDefaultNetwork: "base",
    tokens: BASE_SEPOLIA_TOKENS,
  },
  base: {
    key: "base",
    preferenceValue: "base",
    label: "Base",
    cdpNetworkId: "base",
    x402Network: "eip155:8453",
    chainId: 8453,
    viemChain: base,
    explorerBaseUrl: "https://basescan.org",
    onrampDefaultNetwork: "base",
    tokens: BASE_TOKENS,
  },
};

export function getNetworkFromPreference(
  preference?: PreferredNetworkValue | null,
): SupportedNetworkKey {
  return preference === "base" ? "base" : "base-sepolia";
}

export function getPreferenceFromNetwork(
  network: SupportedNetworkKey,
): PreferredNetworkValue {
  return network === "base" ? "base" : "base_sepolia";
}

export function getNetworkConfig(network?: SupportedNetworkKey | PreferredNetworkValue | null) {
  if (!network) {
    return SUPPORTED_NETWORKS["base-sepolia"];
  }

  if (network === "base" || network === "base-sepolia") {
    return SUPPORTED_NETWORKS[network];
  }

  return network === "base_sepolia"
    ? SUPPORTED_NETWORKS["base-sepolia"]
    : SUPPORTED_NETWORKS.base;
}

export function listSupportedNetworks() {
  return Object.values(SUPPORTED_NETWORKS);
}

export function getSupportedToken(
  network: SupportedNetworkKey | PreferredNetworkValue | null | undefined,
  symbol: string,
) {
  const config = getNetworkConfig(network);
  return config.tokens.find(token => token.symbol === symbol);
}
