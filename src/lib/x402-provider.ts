import { customActionProvider } from "../../node_modules/@coinbase/agentkit/dist/action-providers/customActionProvider";
import { CdpEvmWalletProvider } from "../../node_modules/@coinbase/agentkit/dist/wallet-providers/cdpEvmWalletProvider";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, x402Client, x402HTTPClient } from "@x402/fetch";
import { z } from "zod";

import { discoverBazaarServices, getDexterPremiumServices } from "@/lib/x402-actions";

function getMachineEconomyNetworkFromWallet(walletProvider: CdpEvmWalletProvider) {
  const networkId = walletProvider.getNetwork().networkId;
  if (networkId === "base") {
    return "eip155:8453" as const;
  }

  if (networkId === "base-sepolia") {
    return "eip155:84532" as const;
  }

  return undefined;
}

function createWalletBackedX402Client(walletProvider: CdpEvmWalletProvider) {
  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: {
      address: walletProvider.getAddress() as `0x${string}`,
      signTypedData: async typedData => walletProvider.signTypedData(typedData),
    },
    schemeOptions: process.env.CDP_AGENT_RPC_URL
      ? { rpcUrl: process.env.CDP_AGENT_RPC_URL }
      : undefined,
  });

  return client;
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

const discoverServicesSchema = z.object({
  keyword: z.string().min(2).optional(),
  maxUsdcPrice: z.number().positive().optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

const buyServiceSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.any().optional(),
});

export function createDexterX402ActionProvider() {
  return customActionProvider<CdpEvmWalletProvider>([
    {
      name: "discover_machine_economy_services",
      description:
        "Discover the best matching x402 services from Bazaar quickly and include Agent Bazaar's own premium endpoints.",
      schema: discoverServicesSchema,
      invoke: async (
        walletProvider,
        args: z.infer<typeof discoverServicesSchema>,
      ) => {
        const requestedLimit = Math.min(args.limit ?? 25, 100);
        const network = getMachineEconomyNetworkFromWallet(walletProvider);
        const services = await discoverBazaarServices({
          ...args,
          limit: requestedLimit,
          network,
        });
        const fallbackServices =
          args.keyword && services.length === 0
            ? await discoverBazaarServices({
                maxUsdcPrice: args.maxUsdcPrice,
                limit: Math.min(requestedLimit, 15),
                network,
              })
            : [];
        const premiumServices = getDexterPremiumServices(
          undefined,
          undefined,
          network,
        );

        return JSON.stringify(
          {
            search: {
              keyword: args.keyword ?? null,
              maxUsdcPrice: args.maxUsdcPrice ?? null,
              requestedLimit,
              bazaarMatches: services.length,
              usedFallback: fallbackServices.length > 0,
            },
            bazaarServices: services,
            fallbackBazaarServices: fallbackServices,
            dexterPremiumServices: premiumServices,
          },
          null,
          2,
        );
      },
    },
    {
      name: "buy_machine_economy_service",
      description:
        "Pay for an x402-gated HTTP service using the agent wallet and return the purchased result.",
      schema: buyServiceSchema,
      invoke: async (
        walletProvider,
        args: z.infer<typeof buyServiceSchema>,
      ) => {
        const client = createWalletBackedX402Client(walletProvider);
        const httpClient = new x402HTTPClient(client);
        const fetchWithPayment = wrapFetchWithPayment(fetch, client);
        const headers = new Headers(args.headers ?? {});

        if (args.body !== undefined && !headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }

        const response = await fetchWithPayment(args.url, {
          method: args.method,
          headers,
          body:
            args.body === undefined || args.method === "GET"
              ? undefined
              : typeof args.body === "string"
                ? args.body
                : JSON.stringify(args.body),
        });

        let payment = null;
        try {
          payment = httpClient.getPaymentSettleResponse(name => response.headers.get(name));
        } catch {
          payment = null;
        }

        return JSON.stringify(
          {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            payment,
            data: await parseResponseBody(response),
          },
          null,
          2,
        );
      },
    },
  ]);
}
