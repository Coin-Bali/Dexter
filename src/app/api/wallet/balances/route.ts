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
  const logContext = createRouteLogContext("/api/wallet/balances");

  try {
    const { user } = await requireAuthenticatedUser(request);
    const address = request.nextUrl.searchParams.get("address");
    const networkParam = request.nextUrl.searchParams.get("network");
    const network = getNetworkConfig(
      networkParam === "base" || networkParam === "base-sepolia"
        ? networkParam
        : user.preferredNetwork,
    );
    const usdcToken = network.tokens.find(token => token.symbol === "USDC");

    logRouteStart(logContext, {
      address: maskAddress(address),
      network: network.key,
    });

    if (!address || !isAddress(address)) {
      logRouteWarn(logContext, "route.invalid_address", { address: address ?? null });
      return attachRequestIdHeader(
        NextResponse.json(
          { error: "Valid address query parameter is required" },
          { status: 400 },
        ),
        logContext.requestId,
      );
    }

    const client = createPublicClient({
      chain: network.viemChain,
      transport: http(),
    });

    const [ethBalanceRaw, usdcBalanceRaw] = await Promise.all([
      client.getBalance({ address: address as `0x${string}` }),
      usdcToken?.address
        ? client.readContract({
            address: usdcToken.address,
            abi: erc20BalanceOfAbi,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          }).catch(() => 0n)
        : Promise.resolve(0n),
    ]);

    const ethBalance = formatEther(ethBalanceRaw);
    const usdcBalance = formatUnits(usdcBalanceRaw as bigint, 6);

    const ethFormatted = Number(ethBalance) >= 1
      ? Number(ethBalance).toFixed(4)
      : Number(ethBalance).toFixed(6);

    const usdcFormatted = Number(usdcBalance).toFixed(2);

    logRouteSuccess(logContext, {
      address: maskAddress(address),
      network: network.key,
    });

    return attachRequestIdHeader(
      NextResponse.json({
        address,
        eth: ethFormatted,
        usdc: usdcFormatted,
        network: network.key,
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
                : "Failed to fetch balances",
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
