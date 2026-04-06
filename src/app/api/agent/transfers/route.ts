import { NextRequest, NextResponse } from "next/server";
import { encodeFunctionData, isAddress, parseEther, parseUnits } from "viem";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
  logRouteWarn,
  maskAddress,
} from "@/lib/api-logger";
import { prisma } from "@/lib/db";
import { getNetworkConfig, getSupportedToken } from "@/lib/networks";
import { requireAuthenticatedUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const erc20TransferAbi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export async function POST(request: NextRequest) {
  const logContext = createRouteLogContext("/api/agent/transfers");

  try {
    const { user } = await requireAuthenticatedUser(request);
    const body = await request.json();
    const to = body.to as string | undefined;
    const amount = body.amount as string | undefined;
    const token = body.token as string | undefined;

    logRouteStart(logContext, {
      userId: user.id,
      to: maskAddress(to),
      token: token ?? null,
    });

    if (!to || !isAddress(to) || !amount || !token) {
      logRouteWarn(logContext, "route.invalid_payload");
      return attachRequestIdHeader(
        NextResponse.json({ error: "to, amount, and token are required." }, { status: 400 }),
        logContext.requestId,
      );
    }

    const network = getNetworkConfig(user.preferredNetwork);
    const { getAgentWalletProvider } = await import("@/lib/agentkit");
    const walletProvider = await getAgentWalletProvider({
      id: user.id,
      walletAddress: user.walletAddress,
      preferredNetwork: user.preferredNetwork,
    });

    let transactionHash: string;

    if (token === "ETH") {
      transactionHash = await walletProvider.sendTransaction({
        to: to as `0x${string}`,
        value: parseEther(amount),
      });
    } else {
      const tokenConfig = getSupportedToken(user.preferredNetwork, token);
      if (!tokenConfig?.address) {
        return attachRequestIdHeader(
          NextResponse.json({ error: "Unsupported token for this network." }, { status: 400 }),
          logContext.requestId,
        );
      }

      transactionHash = await walletProvider.sendTransaction({
        to: tokenConfig.address,
        data: encodeFunctionData({
          abi: erc20TransferAbi,
          functionName: "transfer",
          args: [to as `0x${string}`, parseUnits(amount, tokenConfig.decimals)],
        }),
        value: 0n,
      });
    }

    await prisma.agentActivity.create({
      data: {
        userWallet: user.walletAddress,
        toolName: "agent_wallet_transfer",
        args: {
          to,
          amount,
          token,
          network: network.key,
        } as never,
        result: {
          transactionHash,
        } as never,
        status: "success",
      },
    }).catch(() => {});

    logRouteSuccess(logContext, {
      userId: user.id,
      token,
      to: maskAddress(to),
      transactionHash: maskAddress(transactionHash),
    });

    return attachRequestIdHeader(
      NextResponse.json({ ok: true, transactionHash, network: network.key }),
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
                : "Failed to transfer from agent wallet.",
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
