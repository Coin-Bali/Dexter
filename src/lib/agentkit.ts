import { cdpApiActionProvider } from "../../node_modules/@coinbase/agentkit/dist/action-providers/cdp/cdpApiActionProvider";
import { cdpEvmWalletActionProvider } from "../../node_modules/@coinbase/agentkit/dist/action-providers/cdp/cdpEvmWalletActionProvider";
import type {
  Action,
  ActionProvider,
} from "../../node_modules/@coinbase/agentkit/dist/action-providers/actionProvider";
import { pythActionProvider } from "../../node_modules/@coinbase/agentkit/dist/action-providers/pyth/pythActionProvider";
import { walletActionProvider } from "../../node_modules/@coinbase/agentkit/dist/action-providers/wallet/walletActionProvider";
import { CdpEvmWalletProvider } from "../../node_modules/@coinbase/agentkit/dist/wallet-providers/cdpEvmWalletProvider";
import { formatEther } from "viem";

import { prisma } from "@/lib/db";
import { getNetworkConfig } from "@/lib/networks";
import { getDexterPremiumServices } from "@/lib/x402-actions";

type AgentUserContext = {
  id: string;
  walletAddress: string;
  preferredNetwork: "base_sepolia" | "base";
};

type AgentKitLike = {
  getActions: () => Action[];
};

const walletProviderPromises = new Map<string, Promise<CdpEvmWalletProvider>>();
const agentKitPromises = new Map<string, Promise<AgentKitLike>>();

function createAgentKitLike(
  walletProvider: CdpEvmWalletProvider,
  actionProviders: ActionProvider[],
): AgentKitLike {
  return {
    getActions() {
      const actions: Action[] = [];

      for (const actionProvider of actionProviders) {
        if (actionProvider.supportsNetwork(walletProvider.getNetwork())) {
          actions.push(...actionProvider.getActions(walletProvider));
        }
      }

      return actions;
    },
  };
}

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

function getScopeKey(user: AgentUserContext) {
  return `${user.walletAddress.toLowerCase()}:${user.preferredNetwork}`;
}

async function loadUserAgentWallet(user: AgentUserContext) {
  return prisma.userAgentWallet.findFirst({
    where: {
      network: user.preferredNetwork,
      user: {
        walletAddress: user.walletAddress.toLowerCase(),
      },
    },
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

async function createScopedWalletProvider(user: AgentUserContext) {
  if (!isAgentConfigured()) {
    throw new Error(
      `Agent wallet is missing required environment variables: ${getMissingAgentEnv().join(", ")}`,
    );
  }

  const existingWallet = await loadUserAgentWallet(user);
  const networkConfig = getNetworkConfig(user.preferredNetwork);
  const idempotencyKey =
    existingWallet?.cdpWalletReference?.trim() ||
    `agent-bazaar-${user.id}-${user.preferredNetwork}`;

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

export async function getAgentWalletProvider(user: AgentUserContext) {
  const scopeKey = getScopeKey(user);
  if (!walletProviderPromises.has(scopeKey)) {
    walletProviderPromises.set(scopeKey, createScopedWalletProvider(user));
  }

  return walletProviderPromises.get(scopeKey)!;
}

export async function getAgentKit(user: AgentUserContext) {
  const scopeKey = getScopeKey(user);
  if (!agentKitPromises.has(scopeKey)) {
    const walletProvider = await getAgentWalletProvider(user);
    const actionProviders: ActionProvider[] = [
      walletActionProvider(),
      cdpApiActionProvider(),
      cdpEvmWalletActionProvider(),
      pythActionProvider(),
    ];

    try {
      const { createDexterX402ActionProvider } = await import("@/lib/x402-provider");
      actionProviders.push(createDexterX402ActionProvider());
    } catch {
      // Keep chat usable even if the x402 client stack fails to load.
    }

    agentKitPromises.set(
      scopeKey,
      Promise.resolve(createAgentKitLike(walletProvider, actionProviders)),
    );
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
    : "user-selected";

  if (!isAgentConfigured()) {
    return {
      configured: false,
      mode: "per-user",
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

  if (!user) {
    return {
      configured: true,
      mode: "per-user",
      network: targetNetwork,
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

  const walletProvider = await getAgentWalletProvider(user);
  const balance = await walletProvider.getBalance();

  return {
    configured: true,
    mode: "per-user",
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
