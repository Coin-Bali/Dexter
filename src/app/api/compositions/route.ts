import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getNetworkConfig } from "@/lib/networks";
import { requireAuthenticatedUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const publishedOnly = request.nextUrl.searchParams.get("published") === "true";
  try {
    const { user } = await requireAuthenticatedUser(request);
    const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? "1"), 1);
    const pageSize = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("pageSize") ?? "12"), 1),
      50,
    );
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const where: Record<string, unknown> = {
      creatorWallet: user.walletAddress,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    if (publishedOnly) where.isPublished = true;

    const [compositions, total] = await Promise.all([
      prisma.apiComposition.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { calls: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.apiComposition.count({ where }),
    ]);

    return NextResponse.json({ compositions, total, page, pageSize });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : "Failed to load compositions." },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) + `-${Date.now().toString(36)}`;
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const body = await request.json();
    const { name, description, sourceApis, aiPrompt, price, aiModel, network } = body;

    if (!name || !description || !sourceApis || !aiPrompt) {
      return NextResponse.json(
        { error: "name, description, sourceApis, and aiPrompt are required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(sourceApis) || sourceApis.length === 0) {
      return NextResponse.json(
        { error: "sourceApis must be a non-empty array" },
        { status: 400 },
      );
    }

    const slug = generateSlug(name);
    const networkConfig = getNetworkConfig(network === "base" ? "base" : network === "base_sepolia" ? "base_sepolia" : user.preferredNetwork);

    const composition = await prisma.apiComposition.create({
      data: {
        creatorWallet: user.walletAddress,
        name,
        description,
        slug,
        sourceApis,
        aiPrompt,
        price: price || "$0.01",
        aiModel: aiModel || "gpt-4o-mini",
        network: networkConfig.x402Network,
      },
    });

    return NextResponse.json({ composition }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : "Failed to create composition." },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
