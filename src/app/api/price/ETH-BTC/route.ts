import { NextResponse } from "next/server";

import { fetchCoinbaseProductPrice } from "@/utils/coinbase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchCoinbaseProductPrice("ETH-BTC");

    return NextResponse.json({
      price: data.price,
      source: data.source,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch ETH-BTC price.",
      },
      { status: 500 },
    );
  }
}