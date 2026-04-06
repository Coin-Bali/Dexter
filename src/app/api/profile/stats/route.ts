import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthenticatedUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        _count: {
          select: {
            conversations: true,
            paymentEvents: true,
            compositions: true,
          },
        },
      },
    });

    if (!dbUser) {
      return NextResponse.json({
        wallet: user.walletAddress,
        exists: false,
        conversations: 0,
        messages: 0,
        payments: 0,
        compositions: 0,
        apiCalls: 0,
      });
    }

    const [messageCount, apiCallCount] = await Promise.all([
      prisma.message.count({
        where: {
          conversation: { userId: dbUser.id },
          role: "user",
        },
      }),
      prisma.apiCall.count({
        where: {
          composition: { creatorWallet: user.walletAddress },
        },
      }),
    ]);

    return NextResponse.json({
      wallet: user.walletAddress,
      exists: true,
      createdAt: dbUser.createdAt,
      lastSeenAt: dbUser.lastSeenAt,
      conversations: dbUser._count.conversations,
      messages: messageCount,
      payments: dbUser._count.paymentEvents,
      compositions: dbUser._count.compositions,
      apiCalls: apiCallCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : error instanceof Error ? error.message : "Failed to load profile stats" },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
