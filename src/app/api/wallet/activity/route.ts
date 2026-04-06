import { NextRequest, NextResponse } from "next/server";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
} from "@/lib/api-logger";
import { prisma } from "@/lib/db";
import { requireAuthenticatedUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const logContext = createRouteLogContext("/api/wallet/activity");

  try {
    const { user } = await requireAuthenticatedUser(request);
    const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? "1"), 1);
    const pageSize = Math.min(Math.max(Number(request.nextUrl.searchParams.get("pageSize") ?? "20"), 1), 100);
    const start = (page - 1) * pageSize;

    logRouteStart(logContext, {
      userId: user.id,
      page,
      pageSize,
    });

    const [payments, transfers] = await Promise.all([
      prisma.paymentEvent.findMany({
        where: { userWallet: user.walletAddress },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.agentActivity.findMany({
        where: {
          userWallet: user.walletAddress,
          toolName: { in: ["agent_wallet_transfer", "wallet_transfer"] },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const activity = [
      ...payments.map(payment => ({
        id: `payment-${payment.id}`,
        type: "payment" as const,
        title: payment.serviceName,
        status: payment.status,
        amountLabel: payment.price,
        detail: payment.endpoint,
        createdAt: payment.createdAt,
      })),
      ...transfers.map(transfer => ({
        id: `transfer-${transfer.id}`,
        type: "transfer" as const,
        title: transfer.toolName === "agent_wallet_transfer" ? "Agent wallet transfer" : "Wallet transfer",
        status: transfer.status,
        amountLabel: null,
        detail: JSON.stringify(transfer.args ?? transfer.result ?? ""),
        createdAt: transfer.createdAt,
      })),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const total = activity.length;
    const pagedActivity = activity.slice(start, start + pageSize);

    logRouteSuccess(logContext, {
      total,
      page,
      pageSize,
    });

    return attachRequestIdHeader(
      NextResponse.json({
        page,
        pageSize,
        total,
        activity: pagedActivity,
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
                : "Failed to load wallet activity.",
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
