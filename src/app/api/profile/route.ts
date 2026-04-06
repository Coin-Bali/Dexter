import { NextRequest, NextResponse } from "next/server";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
  logRouteWarn,
} from "@/lib/api-logger";
import { prisma } from "@/lib/db";
import { PREFERRED_NETWORK_COOKIE_NAME } from "@/lib/networks";
import { requireAuthenticatedUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const logContext = createRouteLogContext("/api/profile");
  logRouteStart(logContext);

  try {
    const { user } = await requireAuthenticatedUser(request);
    logRouteSuccess(logContext, { userId: user.id });
    return attachRequestIdHeader(
      NextResponse.json({
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          displayName: user.displayName,
          roleDescription: user.roleDescription,
          preferredNetwork: user.preferredNetwork,
          themeMode: user.themeMode,
          registrationCompleted: user.registrationCompleted,
          createdAt: user.createdAt,
          lastSeenAt: user.lastSeenAt,
        },
      }),
      logContext.requestId,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      logRouteWarn(logContext, "route.unauthenticated");
      return attachRequestIdHeader(
        NextResponse.json({ error: "Authentication required." }, { status: 401 }),
        logContext.requestId,
      );
    }
    logRouteError(logContext, error);
    return attachRequestIdHeader(
      NextResponse.json({ error: "Failed to load profile." }, { status: 500 }),
      logContext.requestId,
    );
  }
}

export async function PUT(request: NextRequest) {
  const logContext = createRouteLogContext("/api/profile");
  logRouteStart(logContext);

  try {
    const { user } = await requireAuthenticatedUser(request);
    const body = await request.json();
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
    const roleDescription =
      typeof body.roleDescription === "string" ? body.roleDescription.trim() : undefined;
    const preferredNetwork =
      body.preferredNetwork === "base" ? "base" : body.preferredNetwork === "base_sepolia" ? "base_sepolia" : undefined;
    const themeMode =
      body.themeMode === "light" || body.themeMode === "dark" || body.themeMode === "system"
        ? body.themeMode
        : undefined;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(roleDescription !== undefined ? { roleDescription } : {}),
        ...(preferredNetwork ? { preferredNetwork } : {}),
        ...(themeMode ? { themeMode } : {}),
        registrationCompleted: body.registrationCompleted === true ? true : user.registrationCompleted,
      },
    });

    logRouteSuccess(logContext, {
      userId: user.id,
      preferredNetwork: updatedUser.preferredNetwork,
      themeMode: updatedUser.themeMode,
      registrationCompleted: updatedUser.registrationCompleted,
    });

    const response = NextResponse.json({ user: updatedUser });
    response.cookies.set({
      name: PREFERRED_NETWORK_COOKIE_NAME,
      value: updatedUser.preferredNetwork,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return attachRequestIdHeader(response, logContext.requestId);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      logRouteWarn(logContext, "route.unauthenticated");
      return attachRequestIdHeader(
        NextResponse.json({ error: "Authentication required." }, { status: 401 }),
        logContext.requestId,
      );
    }
    logRouteError(logContext, error);
    return attachRequestIdHeader(
      NextResponse.json({ error: "Failed to update profile." }, { status: 500 }),
      logContext.requestId,
    );
  }
}
