import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteStart,
  logRouteSuccess,
  logRouteWarn,
} from "@/lib/api-logger";
import { prisma } from "@/lib/db";

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const logContext = createRouteLogContext("/api/x402/custom/[slug]");
  const { slug } = await params;
  const start = Date.now();

  logRouteStart(logContext, { slug });

  const composition = await prisma.apiComposition.findUnique({
    where: { slug },
  });

  if (!composition || !composition.isPublished) {
    logRouteWarn(logContext, "route.composition_not_found", { slug });
    return attachRequestIdHeader(
      NextResponse.json(
        { error: "Endpoint not found or not published" },
        { status: 404 },
      ),
      logContext.requestId,
    );
  }

  const sourceApis = composition.sourceApis as SourceApi[];
  const sourceResults = await Promise.all(sourceApis.map(callSourceApi));

  const llmApiKey =
    process.env.LLM_GATEWAY_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();

  let aiResponse: string | null = null;
  let callStatus = "success";

  if (llmApiKey) {
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

    try {
      const result = await generateText({
        model: llm(composition.aiModel || "gpt-4o-mini"),
        prompt,
        maxTokens: 2000,
      });
      aiResponse = result.text;
    } catch {
      callStatus = "ai_error";
    }
  } else {
    callStatus = "no_llm";
  }

  const latencyMs = Date.now() - start;

  prisma.apiCall
    .create({
      data: {
        compositionId: composition.id,
        status: callStatus,
        responsePreview: aiResponse?.slice(0, 2000) ?? null,
        sourceResults: sourceResults as never,
        aiResponse,
        latencyMs,
      },
    })
    .catch(() => {});

  if (callStatus === "ai_error" || callStatus === "no_llm") {
    logRouteWarn(logContext, "route.partial_success", {
      slug,
      callStatus,
      sourceApiCount: sourceApis.length,
      sourceSuccessCount: sourceResults.filter(resultItem => resultItem.ok).length,
    });
  } else {
    logRouteSuccess(logContext, {
      slug,
      sourceApiCount: sourceApis.length,
      sourceSuccessCount: sourceResults.filter(resultItem => resultItem.ok).length,
    });
  }

  return attachRequestIdHeader(
    NextResponse.json({
      service: composition.name,
      description: composition.description,
      generatedAt: new Date().toISOString(),
      sourceData: sourceResults.map(r => ({
        name: r.name,
        ok: r.ok,
        data: r.data,
      })),
      analysis: aiResponse,
      latencyMs,
    }),
    logContext.requestId,
  );
}
