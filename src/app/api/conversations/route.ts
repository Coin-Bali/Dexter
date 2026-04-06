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
      Math.max(Number(request.nextUrl.searchParams.get("pageSize") ?? "15"), 1),
      50,
    );
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const start = (page - 1) * pageSize;

    const where = {
      userId: user.id,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              {
                messages: {
                  some: {
                    content: { contains: search, mode: "insensitive" as const },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
      include: {
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { content: true, role: true },
          },
        },
        skip: start,
        take: pageSize,
      }),
      prisma.conversation.count({ where }),
    ]);

    return NextResponse.json({ conversations, total, page, pageSize });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : "Failed to load conversations." },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const { title } = await request.json();

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: title || null,
      },
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "UNAUTHENTICATED" ? "Authentication required." : "Failed to create conversation." },
      { status: error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 500 },
    );
  }
}
