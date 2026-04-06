import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthenticatedUser } from "@/lib/session";
import { invalidateX402RouteCache } from "@/lib/x402-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const publish = body.publish !== false;

    const existing = await prisma.apiComposition.findFirst({
      where: { id, creatorWallet: user.walletAddress },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Composition not found" }, { status: 404 });
    }

    const composition = await prisma.apiComposition.update({
      where: { id },
      data: { isPublished: publish },
    });

    invalidateX402RouteCache();

    return NextResponse.json({
      composition,
      message: publish
        ? `Published as /api/x402/custom/${composition.slug}`
        : "Unpublished",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : "Failed to update publish status." },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
