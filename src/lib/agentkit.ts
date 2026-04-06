import {
  AgentKit,
  CdpEvmWalletProvider,
  cdpApiActionProvider,
  cdpEvmWalletActionProvider,
  pythActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";
import { formatEther } from "viem";

import { prisma } from "@/lib/db";
import { getNetworkConfig } from "@/lib/networks";
import { getDexterPremiumServices } from "@/lib/x402-actions";
import { createDexterX402ActionProvider } from "@/lib/x402-provider";

const DEFAULT_AGENT_NETWORK = process.env.CDP_AGENT_NETWORK ?? "base";
const GLOBAL_AGENT_IDEMPOTENCY_KEY = "agent-bazaar-global-agent-wallet-v1";

type AgentUserContext = {
  id: string;
  walletAddress: string;
  preferredNetwork: "base_sepolia" | "base";
};

const walletProviderPromises = new Map<string, Promise<CdpEvmWalletProvider>>();
const agentKitPromises = new Map<string, Promise<AgentKit>>();

function getAgentApiKeyId() {
  return process.env.CDP_API_KEY_ID?.trim() || process.env.CDP_API_KEY?.trim();
}

function getAgentApiKeySecret() {
  const value = process.env.CDP_API_KEY_SECRET ?? process.env.CDP_API_SECRET;
  return value?.trim().replace(/\\n/g, "\n");
}

export function getMissingAgentEnv() {
  const missing: string[] = [];

  if (!getAgentApiKeyId()) {
    missing.push("CDP_API_KEY_ID (or CDP_API_KEY)");
  }

  if (!getAgentApiKeySecret()) {
    missing.push("CDP_API_KEY_SECRET (or CDP_API_SECRET)");
  }

  if (!process.env.CDP_WALLET_SECRET?.trim()) {
    missing.push("CDP_WALLET_SECRET");
  }

  return missing;
}

export function isAgentConfigured() {
  return getMissingAgentEnv().length === 0;
}

function getScopeKey(user?: AgentUserContext) {
  return user
    ? `${user.walletAddress.toLowerCase()}:${user.preferredNetwork}`
    : `global:${DEFAULT_AGENT_NETWORK}`;
}

async function loadUserAgentWallet(user: AgentUserContext) {
  const exactWallet = await prisma.userAgentWallet.findFirst({
    where: {
      network: user.preferredNetwork,
      user: {
        walletAddress: user.walletAddress.toLowerCase(),
      },
    },
  });

  if (exactWallet) {
    return exactWallet;
  }

  return prisma.userAgentWallet.findFirst({
    where: {
      user: {
        walletAddress: user.walletAddress.toLowerCase(),
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function persistUserAgentWallet(options: {
  user: AgentUserContext;
  address: string;
  idempotencyKey: string;
}) {
  await prisma.userAgentWallet.upsert({
    where: {
      userId_network: {
        userId: options.user.id,
        network: options.user.preferredNetwork,
      },
    },
    create: {
      userId: options.user.id,
      network: options.user.preferredNetwork,
      address: options.address,
      cdpWalletReference: options.idempotencyKey,
    },
    update: {
      address: options.address,
      cdpWalletReference: options.idempotencyKey,
    },
  });
}

async function createScopedWalletProvider(user?: AgentUserContext) {
  if (!isAgentConfigured()) {
    throw new Error(
      `Agent wallet is missing required environment variables: ${getMissingAgentEnv().join(", ")}`,
    );
  }

  if (user) {
    const existingWallet = await loadUserAgentWallet(user);
    const networkConfig = getNetworkConfig(user.preferredNetwork);
    const idempotencyKey =
      existingWallet?.cdpWalletReference?.trim() ||
      `agent-bazaar-${user.walletAddress.toLowerCase()}`;

    const provider = await CdpEvmWalletProvider.configureWithWallet({
      apiKeyId: getAgentApiKeyId(),
      apiKeySecret: getAgentApiKeySecret(),
      walletSecret: process.env.CDP_WALLET_SECRET?.trim(),
      address: existingWallet?.address as `0x${string}` | undefined,
      idempotencyKey,
      networkId: networkConfig.cdpNetworkId,
      rpcUrl: process.env.CDP_AGENT_RPC_URL?.trim() || process.env.RPC_URL?.trim(),
    });

    await persistUserAgentWallet({
      user,
      address: provider.getAddress(),
      idempotencyKey,
    });

    return provider;
  }

  const envAddress = process.env.CDP_AGENT_WALLET_ADDRESS?.trim() || undefined;
  return CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: getAgentApiKeyId(),
    apiKeySecret: getAgentApiKeySecret(),
    walletSecret: process.env.CDP_WALLET_SECRET?.trim(),
    address: envAddress as `0x${string}` | undefined,
    idempotencyKey:
      process.env.CDP_AGENT_WALLET_IDEMPOTENCY_KEY?.trim() || GLOBAL_AGENT_IDEMPOTENCY_KEY,
    networkId: DEFAULT_AGENT_NETWORK,
    rpcUrl: process.env.CDP_AGENT_RPC_URL?.trim() || process.env.RPC_URL?.trim(),
  });
}

export async function getAgentWalletProvider(user?: AgentUserContext) {
  const scopeKey = getScopeKey(user);
  if (!walletProviderPromises.has(scopeKey)) {
    walletProviderPromises.set(scopeKey, createScopedWalletProvider(user));
  }

  return walletProviderPromises.get(scopeKey)!;
}

export async function getAgentKit(user?: AgentUserContext) {
  const scopeKey = getScopeKey(user);
  if (!agentKitPromises.has(scopeKey)) {
    const walletProvider = await getAgentWalletProvider(user);

    agentKitPromises.set(scopeKey, AgentKit.from({
      walletProvider,
      actionProviders: [
        walletActionProvider(),
        cdpApiActionProvider(),
        cdpEvmWalletActionProvider(),
        pythActionProvider(),
        createDexterX402ActionProvider(),
      ],
    }));
  }

  return agentKitPromises.get(scopeKey)!;
}

export async function getAgentProfile(user?: AgentUserContext) {
  const premiumServices = getDexterPremiumServices(
    undefined,
    undefined,
    user ? getNetworkConfig(user.preferredNetwork).x402Network : undefined,
  );
  const targetNetwork = user
    ? getNetworkConfig(user.preferredNetwork).cdpNetworkId
    : DEFAULT_AGENT_NETWORK;

  if (!isAgentConfigured()) {
    return {
      configured: false,
      missingEnv: getMissingAgentEnv(),
      network: targetNetwork,
      premiumServiceCount: premiumServices.length,
      supportedActions: [
        "wallet details",
        "swap quotes",
        "swap execution",
        "pyth prices",
        "x402 discovery",
        "x402 purchases",
      ],
    };
  }

  const walletProvider = await getAgentWalletProvider(user);
  const balance = await walletProvider.getBalance();

  return {
    configured: true,
    address: walletProvider.getAddress(),
    network: walletProvider.getNetwork(),
    balanceEth: formatEther(balance),
    premiumServiceCount: premiumServices.length,
    supportedActions: [
      "wallet details",
      "native transfers",
      "swap quotes",
      "swap execution",
      "pyth prices",
      "x402 discovery",
      "x402 purchases",
    ],
  };
}
