import { withX402, type RouteConfig } from "@x402/next";
import { NextRequest, NextResponse } from "next/server";

import { getX402Routes, getX402Server } from "@/lib/x402-server";
import { fetchCoinbaseProductPrice } from "@/utils/coinbase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildNarrative(ethUsd: number, btcUsd: number, ethBtc: number) {
  const ethMomentum = ethUsd / btcUsd > ethBtc ? "stable" : "relative-value";

  return {
    marketMode:
      ethBtc > 0.03 ? "ETH is holding strong relative to BTC." : "BTC is leading the pair.",
    executionHint:
      ethMomentum === "stable"
        ? "Use the agent for x402 data discovery, then compare premium signals before swapping."
        : "Use the agent for price discovery first, then request a swap quote before any execution.",
  };
}

const ROUTE_KEY = "GET /api/x402/agent-insight";

async function handleGet(request: NextRequest): Promise<NextResponse<unknown>> {
  void request;
  try {
    const { getAgentProfile } = await import("@/lib/agentkit");
    const [agentProfile, btcUsd, ethUsd, ethBtc] = await Promise.all([
      getAgentProfile(),
      fetchCoinbaseProductPrice("BTC-USD"),
      fetchCoinbaseProductPrice("ETH-USD"),
      fetchCoinbaseProductPrice("ETH-BTC"),
    ]);

    const parsedBtcUsd = Number(btcUsd.price);
    const parsedEthUsd = Number(ethUsd.price);
    const parsedEthBtc = Number(ethBtc.price);

    return NextResponse.json({
      service: "Agent Bazaar Agent Insight",
      generatedAt: new Date().toISOString(),
      agent: agentProfile,
      marketContext: {
        btcUsd: parsedBtcUsd,
        ethUsd: parsedEthUsd,
        ethBtc: parsedEthBtc,
        ...buildNarrative(parsedEthUsd, parsedBtcUsd, parsedEthBtc),
      },
      suggestedPrompts: [
        "Discover paid x402 services for crypto market intelligence under $0.01.",
        "Show my agent wallet details and explain whether it has enough funding on Base.",
        "Get a swap quote from ETH to cbBTC on Base.",
        "Buy a paid service and summarize whether the data changes the current market view.",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate the agent insight report.",
      },
      { status: 500 },
    );
  }
}

const routeConfig = (getX402Routes() as Record<string, RouteConfig>)[ROUTE_KEY];

if (!routeConfig) {
  throw new Error(`Missing x402 route config for ${ROUTE_KEY}.`);
}

export const GET = withX402(handleGet, routeConfig, getX402Server());
