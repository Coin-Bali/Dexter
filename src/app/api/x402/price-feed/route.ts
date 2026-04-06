import { withX402, type RouteConfig } from "@x402/next";
import { NextRequest, NextResponse } from "next/server";

import { getX402Routes, getX402Server } from "@/lib/x402-server";
import { fetchCoinbaseProductPrice } from "@/utils/coinbase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAIRS = ["BTC-USD", "ETH-USD", "ETH-BTC"] as const;
const ROUTE_KEY = "GET /api/x402/price-feed";

async function handleGet(_request: NextRequest): Promise<NextResponse<unknown>> {
  try {
    const prices = await Promise.all(PAIRS.map(pair => fetchCoinbaseProductPrice(pair)));

    return NextResponse.json({
      service: "Agent Bazaar Premium Price Feed",
      generatedAt: new Date().toISOString(),
      prices: prices.map(price => ({
        pair: price.pair,
        price: price.price,
        source: price.source,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate premium price feed.",
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
