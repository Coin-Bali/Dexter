import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, formatEther, formatUnits, http, isAddress } from "viem";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
  logRouteWarn,
  maskAddress,
} from "@/lib/api-logger";
import { getNetworkConfig } from "@/lib/networks";
import { requireAuthenticatedUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const erc20BalanceOfAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export async function GET(request: NextRequest) {
  const logContext = createRouteLogContext("/api/wallet/assets");

  try {
    const { user } = await requireAuthenticatedUser(request);
    const address = request.nextUrl.searchParams.get("address");
    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() ?? "";
    const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? "1"), 1);
    const pageSize = Math.min(Math.max(Number(request.nextUrl.searchParams.get("pageSize") ?? "10"), 1), 50);
    const networkParam = request.nextUrl.searchParams.get("network");
    const network = getNetworkConfig(
      networkParam === "base" || networkParam === "base-sepolia"
        ? networkParam
        : user.preferredNetwork,
    );

    logRouteStart(logContext, {
      address: maskAddress(address),
      network: network.key,
      page,
      pageSize,
      search: search || null,
    });

    if (!address || !isAddress(address)) {
      logRouteWarn(logContext, "route.invalid_address");
      return attachRequestIdHeader(
        NextResponse.json({ error: "Valid address query parameter is required." }, { status: 400 }),
        logContext.requestId,
      );
    }

    const client = createPublicClient({
      chain: network.viemChain,
      transport: http(),
    });

    const assets = await Promise.all(
      network.tokens.map(async token => {
        if (token.isNative) {
          const rawBalance = await client.getBalance({ address: address as `0x${string}` });
          return {
            symbol: token.symbol,
            name: token.name,
            address: null,
            balanceRaw: rawBalance.toString(),
            balanceFormatted: Number(formatEther(rawBalance)).toFixed(6),
            decimals: token.decimals,
            isNative: true,
          };
        }

        if (!token.address) {
          return null;
        }

        const rawBalance = await client.readContract({
          address: token.address,
          abi: erc20BalanceOfAbi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }).catch(() => 0n);

        return {
          symbol: token.symbol,
          name: token.name,
          address: token.address,
          balanceRaw: rawBalance.toString(),
          balanceFormatted: Number(formatUnits(rawBalance, token.decimals)).toFixed(token.decimals >= 8 ? 8 : 6),
          decimals: token.decimals,
          isNative: false,
        };
      }),
    );

    const filteredAssets = assets
      .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
      .filter(asset =>
        !search ||
        asset.symbol.toLowerCase().includes(search) ||
        asset.name.toLowerCase().includes(search),
      );

    const total = filteredAssets.length;
    const start = (page - 1) * pageSize;
    const pagedAssets = filteredAssets.slice(start, start + pageSize);

    logRouteSuccess(logContext, {
      assetCount: total,
      page,
      pageSize,
      network: network.key,
    });

    return attachRequestIdHeader(
      NextResponse.json({
        network: network.key,
        address,
        page,
        pageSize,
        total,
        assets: pagedAssets,
      }),
      logContext.requestId,
    );
  } catch (error) {
    logRouteError(logContext, error);
    return attachRequestIdHeader(
      NextResponse.json(
        {
          error:
            error instanceof Error && error.message === "UNAUTHENTICATED"
              ? "Authentication required."
              : error instanceof Error
                ? error.message
                : "Failed to load wallet assets.",
        },
        {
          status:
            error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500,
        },
      ),
      logContext.requestId,
    );
  }
}
