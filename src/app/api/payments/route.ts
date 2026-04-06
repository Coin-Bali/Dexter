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

    const [events, total] = await Promise.all([
      prisma.paymentEvent.findMany({
        where: { userWallet: user.walletAddress },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.paymentEvent.count({
        where: { userWallet: user.walletAddress },
      }),
    ]);

    return NextResponse.json({ events, total, page, pageSize });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : "Failed to load payments." },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const body = await request.json();
    const { serviceName, endpoint, price, status, responsePreview, txHash } = body;

    if (!serviceName || !endpoint || !price || !status) {
      return NextResponse.json(
        { error: "serviceName, endpoint, price, and status are required" },
        { status: 400 },
      );
    }

    const event = await prisma.paymentEvent.create({
      data: {
        userWallet: user.walletAddress,
        serviceName,
        endpoint,
        price,
        status,
        responsePreview: responsePreview
          ? String(responsePreview).slice(0, 2000)
          : null,
        txHash: txHash || null,
      },
    });

    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : "Failed to save payment." },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
