import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
  logRouteWarn,
} from "@/lib/api-logger";
import { prisma } from "@/lib/db";
import { requireAuthenticatedUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LLM_BASE_URL = "https://llm-gateway.cbhq.net/v1";

type SourceApi = {
  url: string;
  method: string;
  name: string;
};

async function callSourceApi(source: SourceApi) {
  const start = Date.now();
  try {
    const response = await fetch(source.url, {
      method: source.method || "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    const contentType = response.headers.get("content-type") ?? "";
    let data: unknown;
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      name: source.name,
      url: source.url,
      ok: response.ok,
      status: response.status,
      data,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: source.name,
      url: source.url,
      ok: false,
      status: 0,
      data: error instanceof Error ? error.message : "Request failed",
      latencyMs: Date.now() - start,
    };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const logContext = createRouteLogContext("/api/compositions/[id]/test");
  try {
    const { user } = await requireAuthenticatedUser(request);
    const { id } = await params;
    const start = Date.now();

    logRouteStart(logContext, { compositionId: id });

    const composition = await prisma.apiComposition.findFirst({
      where: { id, creatorWallet: user.walletAddress },
    });

    if (!composition) {
      logRouteWarn(logContext, "route.composition_not_found", { compositionId: id });
      return attachRequestIdHeader(
        NextResponse.json({ error: "Composition not found" }, { status: 404 }),
        logContext.requestId,
      );
    }

    const sourceApis = composition.sourceApis as SourceApi[];
    const sourceResults = await Promise.all(sourceApis.map(callSourceApi));

    const llmApiKey =
      process.env.LLM_GATEWAY_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();

    if (!llmApiKey) {
      logRouteWarn(logContext, "route.missing_llm_api_key", {
        compositionId: composition.id,
        sourceApiCount: sourceApis.length,
      });
      return attachRequestIdHeader(
        NextResponse.json({
          testMode: true,
          composition: { id: composition.id, name: composition.name, slug: composition.slug },
          sourceResults,
          aiResponse: null,
          error: "LLM_GATEWAY_API_KEY not configured - showing source results only",
          latencyMs: Date.now() - start,
        }),
        logContext.requestId,
      );
    }

    const llm = createOpenAI({
      apiKey: llmApiKey,
      baseURL: process.env.LLM_GATEWAY_BASE_URL?.trim() || DEFAULT_LLM_BASE_URL,
    });

    const prompt = `${composition.aiPrompt}

Here are the results from the source APIs:

${sourceResults.map(r => `### ${r.name} (${r.url})
Status: ${r.ok ? "Success" : "Failed"} (${r.status})
Data:
${typeof r.data === "string" ? r.data : JSON.stringify(r.data, null, 2)}
`).join("\n")}

Based on the above data, provide your analysis and response.`;

    const result = await generateText({
      model: llm(composition.aiModel || "gpt-4o-mini"),
      prompt,
      maxTokens: 2000,
    });

    logRouteSuccess(logContext, {
      compositionId: composition.id,
      sourceApiCount: sourceApis.length,
      sourceSuccessCount: sourceResults.filter(resultItem => resultItem.ok).length,
    });

    return attachRequestIdHeader(
      NextResponse.json({
        testMode: true,
        composition: { id: composition.id, name: composition.name, slug: composition.slug },
        sourceResults,
        aiResponse: result.text,
        latencyMs: Date.now() - start,
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
      NextResponse.json({
        testMode: true,
        aiResponse: null,
        error:
          error instanceof Error && error.message === "UNAUTHENTICATED"
            ? "Authentication required."
            : error instanceof Error
              ? error.message
              : "AI processing failed",
      }),
      logContext.requestId,
    );
  }
}
