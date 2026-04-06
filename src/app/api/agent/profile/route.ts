import { NextResponse } from "next/server";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
  maskAddress,
} from "@/lib/api-logger";
import { requireAuthenticatedUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const logContext = createRouteLogContext("/api/agent/profile");
  logRouteStart(logContext);
  try {
    const { user } = await requireAuthenticatedUser(request);
    const { getAgentProfile } = await import("@/lib/agentkit");
    const profile = await getAgentProfile({
      id: user.id,
      walletAddress: user.walletAddress,
      preferredNetwork: user.preferredNetwork,
    });
    logRouteSuccess(logContext, {
      configured: profile.configured,
      address: maskAddress((profile as { address?: string }).address),
      network: profile.network,
    });
    return attachRequestIdHeader(NextResponse.json(profile), logContext.requestId);
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
                : "Failed to load agent profile.",
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
