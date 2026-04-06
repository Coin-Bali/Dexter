const BAZAAR_DISCOVERY_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources";
const DEFAULT_ORIGIN = "http://localhost:3000";
const DEFAULT_USDC_DECIMALS = 6;
const DEFAULT_NETWORK = "eip155:84532";
const MAX_BAZAAR_PAGE_SIZE = 200;
const BAZAAR_CACHE_TTL_MS = 60_000;
export const X402_PAY_TO_QUERY_PARAM = "payTo";

type BazaarPagePayload = {
  items: unknown[];
  total?: number;
};

const bazaarPageCache = new Map<string, { expiresAt: number; value: BazaarPagePayload }>();
const bazaarPageInflight = new Map<string, Promise<BazaarPagePayload>>();
const bazaarSearchCache = new Map<string, { expiresAt: number; value: MachineEconomyService[] }>();

export type MachineEconomyService = {
  id: string;
  name: string;
  description: string;
  url: string;
  method: string;
  price: string;
  maxUsdcPrice: number | null;
  network: string;
  category: string | null;
  qualityScore: number | null;
  tags: string[];
  source: "bazaar" | "dexter";
};

function getDefaultOrigin() {
  return process.env.BASE_URL?.trim() || DEFAULT_ORIGIN;
}

function parseUsdPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const match = value.match(/[0-9]+(?:\.[0-9]+)?/);
    if (match) {
      return Number(match[0]);
    }
  }

  return null;
}

export function getConfiguredMachineEconomyNetwork() {
  const x402Network = process.env.X402_NETWORK?.trim();
  if (x402Network) {
    return x402Network as `${string}:${string}`;
  }

  const agentNetwork = process.env.CDP_AGENT_NETWORK?.trim();
  if (agentNetwork === "base") {
    return "eip155:8453";
  }

  if (agentNetwork === "base-sepolia") {
    return "eip155:84532";
  }

  return (
    DEFAULT_NETWORK
  ) as `${string}:${string}`;
}

export function getMachineEconomyNetworkForPreference(
  preference?: "base_sepolia" | "base" | null,
) {
  if (preference === "base") {
    return "eip155:8453" as const;
  }

  if (preference === "base_sepolia") {
    return "eip155:84532" as const;
  }

  return getConfiguredMachineEconomyNetwork();
}

function parseUsdcAmount(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const isWholeUnitAmount =
    typeof value === "number" ? Number.isInteger(value) : /^\d+$/.test(value);

  return isWholeUnitAmount ? parsed / 10 ** DEFAULT_USDC_DECIMALS : parsed;
}

function formatUsdAmount(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }

  return `$${value.toFixed(6).replace(/\.?0+$/, "")}`;
}

function resolvePrice(primaryAccept: Record<string, unknown>) {
  const explicitPrice =
    (primaryAccept.price as string | number | undefined) ??
    (primaryAccept.amountUsd as string | number | undefined);
  const parsedExplicitPrice = parseUsdPrice(explicitPrice);

  if (parsedExplicitPrice !== null) {
    return {
      label:
        typeof explicitPrice === "string" && explicitPrice.includes("$")
          ? explicitPrice
          : formatUsdAmount(parsedExplicitPrice) ?? "$0.001",
      maxUsdcPrice: parsedExplicitPrice,
    };
  }

  const amountPrice = parseUsdcAmount(primaryAccept.amount);
  if (amountPrice !== null) {
    return {
      label: formatUsdAmount(amountPrice) ?? "$0.001",
      maxUsdcPrice: amountPrice,
    };
  }

  return {
    label: "$0.001",
    maxUsdcPrice: 0.001,
  };
}

function toRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function getServiceLabel(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

function appendPayToQuery(url: string, payTo?: string) {
  const payToAddress = payTo?.trim();
  if (!payToAddress) {
    return url;
  }

  try {
    const parsed = new URL(url);
    parsed.searchParams.set(X402_PAY_TO_QUERY_PARAM, payToAddress);
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((tag): tag is string => typeof tag === "string");
}

function buildSearchHaystack(item: MachineEconomyService) {
  return [
    item.name,
    item.description,
    item.category ?? "",
    item.tags.join(" "),
    item.url,
  ]
    .join(" ")
    .toLowerCase();
}

function tokenizeKeyword(keyword: string) {
  return keyword
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map(token => token.trim())
    .filter(token => token.length >= 2);
}

function getKeywordMatchScore(item: MachineEconomyService, keyword?: string) {
  const normalizedKeyword = keyword?.trim().toLowerCase();
  if (!normalizedKeyword) {
    return 1;
  }

  const haystack = buildSearchHaystack(item);
  const tokens = tokenizeKeyword(normalizedKeyword);
  if (tokens.length === 0) {
    return haystack.includes(normalizedKeyword) ? 100 : 0;
  }

  let score = haystack.includes(normalizedKeyword) ? 100 : 0;
  let matchedTokenCount = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      matchedTokenCount += 1;
      score += 20;
    }
  }

  if (matchedTokenCount === tokens.length) {
    score += 40;
  }

  return score;
}

async function fetchBazaarPage(limit: number, offset: number) {
  const cacheKey = `${limit}:${offset}`;
  const cached = bazaarPageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = bazaarPageInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const params = new URLSearchParams({
    type: "http",
    limit: String(limit),
    offset: String(offset),
  });

  const requestPromise = (async () => {
    const response = await fetch(`${BAZAAR_DISCOVERY_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to discover x402 services from Bazaar.");
    }

    const payload = await response.json();
    const parsed = {
      items: Array.isArray(payload.items) ? payload.items : [],
      total:
        typeof payload.pagination?.total === "number"
          ? payload.pagination.total
          : undefined,
    };

    bazaarPageCache.set(cacheKey, {
      expiresAt: Date.now() + BAZAAR_CACHE_TTL_MS,
      value: parsed,
    });

    return parsed;
  })();

  bazaarPageInflight.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    bazaarPageInflight.delete(cacheKey);
  }
}

function normalizeDiscoveryItem(item: unknown): MachineEconomyService | null {
  const record = toRecord(item);
  const acceptsValue = record.accepts;
  const accepts = Array.isArray(acceptsValue)
    ? acceptsValue
    : acceptsValue
      ? [acceptsValue]
      : [];
  const primaryAccept = toRecord(accepts[0]);
  const extensions = toRecord(record.extensions);
  const bazaar = toRecord(extensions.bazaar);
  const url =
    (record.url as string | undefined) ||
    (record.resource as string | undefined) ||
    (record.endpoint as string | undefined);

  if (!url) {
    return null;
  }

  const serviceLabel = getServiceLabel(url);
  const description =
    (record.description as string | undefined) ||
    `x402 service discovered from Bazaar at ${serviceLabel}`;
  const name =
    (record.name as string | undefined) ||
    (record.title as string | undefined) ||
    serviceLabel;
  const method =
    (record.method as string | undefined) ||
    (record.httpMethod as string | undefined) ||
    "GET";
  const { label: price, maxUsdcPrice } = resolvePrice(primaryAccept);
  const qualityScoreRaw =
    (record.qualityScore as number | undefined) ??
    (record.quality_score as number | undefined);

  return {
    id: (record.id as string | undefined) || url,
    name,
    description,
    url,
    method,
    price,
    maxUsdcPrice,
    network: (primaryAccept.network as string | undefined) || DEFAULT_NETWORK,
    category: (bazaar.category as string | undefined) || null,
    qualityScore: typeof qualityScoreRaw === "number" ? qualityScoreRaw : null,
    tags: normalizeTags(bazaar.tags),
    source: "bazaar",
  };
}

export function getDexterPremiumServices(
  origin = getDefaultOrigin(),
  payTo?: string,
  network = getConfiguredMachineEconomyNetwork(),
): MachineEconomyService[] {
  return [
    {
      id: "dexter-price-feed",
      name: "Agent Bazaar Premium Price Feed",
      description:
        "Low-cost multi-asset market snapshot combining BTC-USD, ETH-USD, and ETH-BTC.",
      url: appendPayToQuery(`${origin}/api/x402/price-feed`, payTo),
      method: "GET",
      price: "$0.001",
      maxUsdcPrice: 0.001,
      network,
      category: "market-data",
      qualityScore: 1,
      tags: ["coinbase", "prices", "machine-commerce", "agent-bazaar"],
      source: "dexter",
    },
    {
      id: "dexter-agent-insight",
      name: "Agent Bazaar Agent Insight",
      description:
        "Premium machine-economy report that combines market data, agent wallet state, and suggested prompts.",
      url: appendPayToQuery(`${origin}/api/x402/agent-insight`, payTo),
      method: "GET",
      price: "$0.01",
      maxUsdcPrice: 0.01,
      network,
      category: "agent-analytics",
      qualityScore: 1,
      tags: ["insights", "agentkit", "x402", "agent-bazaar"],
      source: "dexter",
    },
  ];
}

export async function discoverBazaarServices(options?: {
  keyword?: string;
  maxUsdcPrice?: number;
  limit?: number;
  network?: string;
}) {
  const cacheKey = JSON.stringify({
    keyword: options?.keyword?.trim().toLowerCase() ?? null,
    maxUsdcPrice: options?.maxUsdcPrice ?? null,
    limit: options?.limit ?? 12,
    network: options?.network ?? getConfiguredMachineEconomyNetwork(),
  });
  const cached = bazaarSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const requestedLimit = options?.limit ?? 12;
  const targetNetwork = options?.network ?? getConfiguredMachineEconomyNetwork();
  const shouldScanEntireCatalog = Boolean(options?.keyword?.trim());
  const candidateServices: MachineEconomyService[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const page = await fetchBazaarPage(MAX_BAZAAR_PAGE_SIZE, offset);
    total = page.total ?? offset + page.items.length;

    const pageCandidates = page.items
      .map(normalizeDiscoveryItem)
      .filter((item: MachineEconomyService | null): item is MachineEconomyService => item !== null)
      .filter((item: MachineEconomyService) => item.network === targetNetwork)
      .filter((item: MachineEconomyService) => {
        if (options?.maxUsdcPrice === undefined) {
          return true;
        }

        return item.maxUsdcPrice === null || item.maxUsdcPrice <= options.maxUsdcPrice;
      });

    candidateServices.push(...pageCandidates);

    if (!shouldScanEntireCatalog && candidateServices.length >= requestedLimit) {
      break;
    }

    if (page.items.length < MAX_BAZAAR_PAGE_SIZE) {
      break;
    }

    offset += MAX_BAZAAR_PAGE_SIZE;
  }

  const scoredServices = candidateServices
    .map(service => ({
      service,
      score: getKeywordMatchScore(service, options?.keyword),
    }))
    .filter(result => result.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (right.service.qualityScore ?? 0) - (left.service.qualityScore ?? 0);
    });

  const finalResults = scoredServices.slice(0, requestedLimit).map(result => result.service);
  bazaarSearchCache.set(cacheKey, {
    expiresAt: Date.now() + BAZAAR_CACHE_TTL_MS,
    value: finalResults,
  });
  return finalResults;
}
