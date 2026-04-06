import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthenticatedUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? "1"), 1);
    const pageSize = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("pageSize") ?? request.nextUrl.searchParams.get("limit") ?? "50"), 1),
      200,
    );

    const [activities, total] = await Promise.all([
      prisma.agentActivity.findMany({
        where: { userWallet: user.walletAddress },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.agentActivity.count({
        where: { userWallet: user.walletAddress },
      }),
    ]);

    return NextResponse.json({ activities, total, page, pageSize });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : "Failed to load activity." },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
