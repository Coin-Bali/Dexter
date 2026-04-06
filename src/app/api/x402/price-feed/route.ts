import { NextResponse } from "next/server";

import { fetchCoinbaseProductPrice } from "@/utils/coinbase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAIRS = ["BTC-USD", "ETH-USD", "ETH-BTC"] as const;

export async function GET() {
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
