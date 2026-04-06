import { NextRequest, NextResponse } from "next/server";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
  logRouteWarn,
  maskAddress,
} from "@/lib/api-logger";
import { getSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const logContext = createRouteLogContext("/api/auth/session");
  logRouteStart(logContext);

  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      logRouteWarn(logContext, "route.session_missing");
      return attachRequestIdHeader(
        NextResponse.json({ authenticated: false }, { status: 401 }),
        logContext.requestId,
      );
    }

    logRouteSuccess(logContext, {
      userId: session.user.id,
      walletAddress: maskAddress(session.user.walletAddress),
    });

    return attachRequestIdHeader(
      NextResponse.json({
        authenticated: true,
        user: {
          id: session.user.id,
          walletAddress: session.user.walletAddress,
          displayName: session.user.displayName,
          roleDescription: session.user.roleDescription,
          preferredNetwork: session.user.preferredNetwork,
          themeMode: session.user.themeMode,
          registrationCompleted: session.user.registrationCompleted,
          createdAt: session.user.createdAt,
          lastSeenAt: session.user.lastSeenAt,
        },
      }),
      logContext.requestId,
    );
  } catch (error) {
    logRouteError(logContext, error);
    return attachRequestIdHeader(
      NextResponse.json({ error: "Failed to load session." }, { status: 500 }),
      logContext.requestId,
    );
  }
}
