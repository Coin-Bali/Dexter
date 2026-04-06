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
import { normalizeWalletAddress, verifyWalletSignature } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clearSessionCookie, createUserSession, setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || null;
}

export async function POST(request: NextRequest) {
  const logContext = createRouteLogContext("/api/auth/verify");

  try {
    const body = await request.json();
    const walletAddress = body.walletAddress as string | undefined;
    const signature = body.signature as `0x${string}` | undefined;

    logRouteStart(logContext, {
      walletAddress: maskAddress(walletAddress),
    });

    if (!walletAddress || !isAddress(walletAddress) || !signature) {
      logRouteWarn(logContext, "route.invalid_payload");
      return attachRequestIdHeader(
        NextResponse.json({ error: "walletAddress and signature are required." }, { status: 400 }),
        logContext.requestId,
      );
    }

    const normalizedWallet = normalizeWalletAddress(walletAddress);
    const authNonce = await prisma.authNonce.findFirst({
      where: {
        walletAddress: normalizedWallet,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!authNonce) {
      logRouteWarn(logContext, "route.auth_nonce_missing", {
        walletAddress: maskAddress(walletAddress),
      });
      return attachRequestIdHeader(
        NextResponse.json({ error: "Authentication challenge expired. Please try again." }, { status: 401 }),
        logContext.requestId,
      );
    }

    const signatureValid = await verifyWalletSignature({
      walletAddress,
      nonce: authNonce.nonce,
      signature,
    });

    if (!signatureValid) {
      logRouteWarn(logContext, "route.invalid_signature", {
        walletAddress: maskAddress(walletAddress),
      });
      return attachRequestIdHeader(
        NextResponse.json({ error: "Invalid wallet signature." }, { status: 401 }),
        logContext.requestId,
      );
    }

    await prisma.authNonce.update({
      where: { id: authNonce.id },
      data: { consumedAt: new Date() },
    });

    const user = await prisma.user.upsert({
      where: { walletAddress: normalizedWallet },
      create: { walletAddress: normalizedWallet },
      update: { lastSeenAt: new Date() },
    });

    const { sessionToken, expiresAt } = await createUserSession({
      userId: user.id,
      userAgent: request.headers.get("user-agent"),
      ipAddress: getClientIp(request),
    });

    const response = NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        preferredNetwork: user.preferredNetwork,
        themeMode: user.themeMode,
        registrationCompleted: user.registrationCompleted,
      },
    });

    setSessionCookie(response, sessionToken, expiresAt);

    logRouteSuccess(logContext, {
      walletAddress: maskAddress(walletAddress),
      userId: user.id,
      registrationCompleted: user.registrationCompleted,
    });

    return attachRequestIdHeader(response, logContext.requestId);
  } catch (error) {
    logRouteError(logContext, error);
    const response = NextResponse.json({ error: "Failed to verify wallet." }, { status: 500 });
    clearSessionCookie(response);
    return attachRequestIdHeader(response, logContext.requestId);
  }
}
