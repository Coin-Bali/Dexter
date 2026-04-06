import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  type RoutesConfig,
  x402ResourceServer,
} from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

import {
  X402_PAY_TO_QUERY_PARAM,
  getConfiguredMachineEconomyNetwork,
} from "@/lib/x402-actions";

const DEFAULT_FACILITATOR_URL = "https://x402.org/facilitator";
const X402_PAY_TO_HEADER = "x-agent-bazaar-pay-to";
const ROUTE_CACHE_TTL_MS = 30_000;

const serverInstances = new Map<string, x402ResourceServer>();
const httpServerInstances = new Map<string, x402HTTPResourceServer>();
let routeCacheTimestamp = 0;

type X402RequestContext = {
  adapter: {
    getHeader(name: string): string | undefined;
    getQueryParam?(name: string): string | string[] | undefined;
  };
};

type PublishedComposition = {
  slug: string;
  name: string;
  description: string;
  price: string;
  network: string;
};

let cachedDynamicRoutes: PublishedComposition[] = [];

function readFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim();
  }

  return value?.trim();
}

function getFallbackX402PayToAddress() {
  return process.env.X402_PAY_TO_ADDRESS?.trim();
}

function getPayToAddressFromRequest(context: X402RequestContext) {
  const queryValue = readFirstValue(
    context.adapter.getQueryParam?.(X402_PAY_TO_QUERY_PARAM),
  );
  const headerValue = context.adapter.getHeader(X402_PAY_TO_HEADER)?.trim();

  return queryValue || headerValue || getFallbackX402PayToAddress();
}

export function getX402PayToAddress() {
  const payToAddress = getFallbackX402PayToAddress();
  if (!payToAddress) {
    throw new Error("X402_PAY_TO_ADDRESS must be configured to enable x402 payments.");
  }

  return payToAddress;
}

export function getX402Network() {
  return getConfiguredMachineEconomyNetwork();
}

export function getX402Server(network = getX402Network()) {
  if (!serverInstances.has(network)) {
    const facilitatorClient = new HTTPFacilitatorClient({
      url: process.env.X402_FACILITATOR_URL?.trim() || DEFAULT_FACILITATOR_URL,
    });

    const serverInstance = new x402ResourceServer(facilitatorClient);
    registerExactEvmScheme(serverInstance, {
      networks: [network as `${string}:${string}`],
    });
    serverInstances.set(network, serverInstance);
  }

  return serverInstances.get(network)!;
}

export function invalidateX402RouteCache() {
  routeCacheTimestamp = 0;
  httpServerInstances.clear();
}

async function loadPublishedCompositions(): Promise<PublishedComposition[]> {
  const now = Date.now();
  if (now - routeCacheTimestamp < ROUTE_CACHE_TTL_MS && cachedDynamicRoutes.length > 0) {
    return cachedDynamicRoutes;
  }

  try {
    const { prisma } = await import("@/lib/db");
    const compositions = await prisma.apiComposition.findMany({
      where: { isPublished: true },
      select: {
        slug: true,
        name: true,
        description: true,
        price: true,
        network: true,
      },
    });
    cachedDynamicRoutes = compositions;
    routeCacheTimestamp = now;
    return compositions;
  } catch {
    return cachedDynamicRoutes;
  }
}

export function getX402HttpServer(network = getX402Network()) {
  if (!httpServerInstances.has(network)) {
    const httpServerInstance = new x402HTTPResourceServer(
      getX402Server(network),
      getX402Routes(network),
    );
    httpServerInstance.onProtectedRequest(async context => {
      if (!getPayToAddressFromRequest(context)) {
        return {
          abort: true,
          reason: `Provide the user's embedded wallet via the ${X402_PAY_TO_HEADER} header or ${X402_PAY_TO_QUERY_PARAM} query parameter, or configure X402_PAY_TO_ADDRESS as a fallback.`,
        };
      }
    });
    httpServerInstances.set(network, httpServerInstance);
  }

  return httpServerInstances.get(network)!;
}

export async function getX402HttpServerWithDynamicRoutes(network = getX402Network()) {
  const dynamicCompositions = await loadPublishedCompositions();
  const routes = getX402Routes(network);

  for (const comp of dynamicCompositions) {
    const routeKey = `GET /api/x402/custom/${comp.slug}` as keyof typeof routes;
    (routes as Record<string, (typeof routes)[keyof typeof routes]>)[routeKey] = {
      accepts: [
        {
          scheme: "exact",
          price: comp.price,
          network: comp.network as `${string}:${string}`,
          payTo: (context: X402RequestContext) => {
            const payToAddress = getPayToAddressFromRequest(context);
            if (!payToAddress) {
              throw new Error("No x402 payout address was provided for this request.");
            }
            return payToAddress;
          },
        },
      ],
      description: comp.description,
      mimeType: "application/json",
      extensions: {
        bazaar: {
          discoverable: true,
          category: "composite-api",
          tags: ["agent-bazaar", "composite", "ai-powered"],
        },
      },
    };
  }

  const server = new x402HTTPResourceServer(getX402Server(network), routes);
  server.onProtectedRequest(async context => {
    if (!getPayToAddressFromRequest(context)) {
      return {
        abort: true,
        reason: `Provide the user's embedded wallet via the ${X402_PAY_TO_HEADER} header or ${X402_PAY_TO_QUERY_PARAM} query parameter, or configure X402_PAY_TO_ADDRESS as a fallback.`,
      };
    }
  });

  return server;
}

export function getX402Routes(network = getX402Network()): RoutesConfig {

  return {
    "GET /api/x402/price-feed": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.001",
          network,
          payTo: (context: X402RequestContext) => {
            const payToAddress = getPayToAddressFromRequest(context);
            if (!payToAddress) {
              throw new Error("No x402 payout address was provided for this request.");
            }

            return payToAddress;
          },
        },
      ],
      description:
        "Agent Bazaar premium market feed for BTC-USD, ETH-USD, and ETH-BTC snapshots.",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          discoverable: true,
          category: "crypto-data",
          tags: ["prices", "market-data", "coinbase", "agent-bazaar"],
        },
      },
    },
    "GET /api/x402/agent-insight": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.01",
          network,
          payTo: (context: X402RequestContext) => {
            const payToAddress = getPayToAddressFromRequest(context);
            if (!payToAddress) {
              throw new Error("No x402 payout address was provided for this request.");
            }

            return payToAddress;
          },
        },
      ],
      description:
        "Agent Bazaar premium agent insight report with wallet state, prompts, and market context.",
      mimeType: "application/json",
      extensions: {
        bazaar: {
          discoverable: true,
          category: "agent-analytics",
          tags: ["agentkit", "insight", "machine-economy", "agent-bazaar"],
        },
      },
    },
  };
}
