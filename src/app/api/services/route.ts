import { NextRequest, NextResponse } from "next/server";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
  maskAddress,
} from "@/lib/api-logger";
import { getNetworkConfig } from "@/lib/networks";
import { requireAuthenticatedUser } from "@/lib/session";
import {
  discoverBazaarServices,
  getDexterPremiumServices,
} from "@/lib/x402-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveRequestOrigin(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(/:$/, "");

  return `${protocol}://${host}`;
}

export async function GET(request: NextRequest) {
  const logContext = createRouteLogContext("/api/services");

  try {
    const { user } = await requireAuthenticatedUser(request);
    const { searchParams } = request.nextUrl;
    const origin = resolveRequestOrigin(request);
    const keyword = searchParams.get("keyword") ?? undefined;
    const payTo = user.walletAddress;
    const network = getNetworkConfig(user.preferredNetwork).x402Network;

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? "50"), 1),
      200,
    );
    const maxPrice = searchParams.has("maxPrice")
      ? Number(searchParams.get("maxPrice"))
      : undefined;
    const maxUsdcPrice =
      maxPrice !== undefined && Number.isFinite(maxPrice) ? maxPrice : 10;

    logRouteStart(logContext, {
      keyword: keyword ?? null,
      payTo: maskAddress(payTo),
      limit,
      maxUsdcPrice,
      network,
    });

    let publishedCompositions: Array<{
      id: string;
      name: string;
      description: string;
      slug: string;
      price: string;
      network: string;
    }> = [];

    try {
      const { prisma } = await import("@/lib/db");
      publishedCompositions = await prisma.apiComposition.findMany({
        where: { isPublished: true },
        select: { id: true, name: true, description: true, slug: true, price: true, network: true },
      });
    } catch {
      // DB not available -- skip compositions
    }

    const compositionServices = publishedCompositions.map(comp => ({
      id: `composition-${comp.id}`,
      name: comp.name,
      description: comp.description,
      url: `${origin}/api/x402/custom/${comp.slug}`,
      method: "GET" as const,
      price: comp.price,
      maxUsdcPrice: Number(comp.price.replace(/[^0-9.]/g, "")) || 0.01,
      network: comp.network,
      category: "composite-api" as const,
      qualityScore: 1,
      tags: ["agent-bazaar", "composite", "ai-powered"] as string[],
      source: "dexter" as const,
    }));

    const [bazaarServices, dexterPremiumServices] = await Promise.all([
      discoverBazaarServices({
        keyword,
        limit,
        maxUsdcPrice,
        network,
      }),
      Promise.resolve(getDexterPremiumServices(origin, payTo, network)),
    ]);

    logRouteSuccess(logContext, {
      bazaarCount: bazaarServices.length,
      dexterCount: dexterPremiumServices.length,
      compositionCount: compositionServices.length,
    });

    return attachRequestIdHeader(
      NextResponse.json({
        network,
        bazaarServices,
        dexterPremiumServices: [...dexterPremiumServices, ...compositionServices],
        totalBazaar: bazaarServices.length,
      }),
      logContext.requestId,
    );
  } catch (error) {
    logRouteError(logContext, error, {
      status:
        error instanceof Error && error.message === "UNAUTHENTICATED"
          ? "unauthenticated"
          : "failed",
    });
    return attachRequestIdHeader(
      NextResponse.json(
        {
          error:
            error instanceof Error && error.message === "UNAUTHENTICATED"
              ? "Authentication required."
              : error instanceof Error
                ? error.message
                : "Failed to load services.",
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
