import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
  logRouteWarn,
  maskAddress,
} from "@/lib/api-logger";
import {
  AUTH_NONCE_TTL_MS,
  buildWalletAuthMessage,
  createNonce,
  normalizeWalletAddress,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const logContext = createRouteLogContext("/api/auth/challenge");
  try {
    const body = await request.json();
    const walletAddress = body.walletAddress as string | undefined;

    logRouteStart(logContext, {
      walletAddress: maskAddress(walletAddress),
    });

    if (!walletAddress || !isAddress(walletAddress)) {
      logRouteWarn(logContext, "route.invalid_wallet");
      return attachRequestIdHeader(
        NextResponse.json({ error: "Valid walletAddress is required." }, { status: 400 }),
        logContext.requestId,
      );
    }

    const normalizedWallet = normalizeWalletAddress(walletAddress);
    const nonce = createNonce();
    const expiresAt = new Date(Date.now() + AUTH_NONCE_TTL_MS);

    await prisma.authNonce.create({
      data: {
        walletAddress: normalizedWallet,
        nonce,
        expiresAt,
      },
    });

    const message = buildWalletAuthMessage(walletAddress, nonce);

    logRouteSuccess(logContext, {
      walletAddress: maskAddress(walletAddress),
      expiresAt: expiresAt.toISOString(),
    });

    return attachRequestIdHeader(
      NextResponse.json({
        nonce,
        message,
        expiresAt: expiresAt.toISOString(),
      }),
      logContext.requestId,
    );
  } catch (error) {
    logRouteError(logContext, error);
    return attachRequestIdHeader(
      NextResponse.json({ error: "Failed to create auth challenge." }, { status: 500 }),
      logContext.requestId,
    );
  }
}
