import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthenticatedUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const { id } = await params;

    const composition = await prisma.apiComposition.findFirst({
      where: { id, creatorWallet: user.walletAddress },
      include: {
        _count: { select: { calls: true } },
        calls: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            latencyMs: true,
            createdAt: true,
            callerWallet: true,
          },
        },
      },
    });

    if (!composition) {
      return NextResponse.json({ error: "Composition not found" }, { status: 404 });
    }

    return NextResponse.json({ composition });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : "Failed to load composition." },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const { id } = await params;
    const body = await request.json();

    const allowedFields = ["name", "description", "sourceApis", "aiPrompt", "price", "aiModel", "network"] as const;
    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const existing = await prisma.apiComposition.findFirst({
      where: { id, creatorWallet: user.walletAddress },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Composition not found" }, { status: 404 });
    }

    const composition = await prisma.apiComposition.update({
      where: { id },
      data,
    });
    return NextResponse.json({ composition });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : "Failed to update composition." },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const { id } = await params;

    await prisma.apiComposition.deleteMany({
      where: { id, creatorWallet: user.walletAddress },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : "Failed to delete composition." },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
