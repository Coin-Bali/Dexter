import { NextRequest, NextResponse } from "next/server";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
} from "@/lib/api-logger";
import { clearSessionCookie, deleteSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const logContext = createRouteLogContext("/api/auth/logout");
  logRouteStart(logContext);

  try {
    await deleteSessionFromRequest(request);
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    logRouteSuccess(logContext);
    return attachRequestIdHeader(response, logContext.requestId);
  } catch (error) {
    logRouteError(logContext, error);
    const response = NextResponse.json({ error: "Failed to logout." }, { status: 500 });
    clearSessionCookie(response);
    return attachRequestIdHeader(response, logContext.requestId);
  }
}
