import { createOpenAI } from "@ai-sdk/openai";
import { withX402, type RouteConfig } from "@x402/next";
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
import { X402_PAY_TO_QUERY_PARAM } from "@/lib/x402-actions";
import { getX402Server } from "@/lib/x402-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LLM_BASE_URL = "https://llm-gateway.cbhq.net/v1";

type SourceApi = {
  url: string;
  method: string;
  name: string;
};

const X402_PAY_TO_HEADER = "x-agent-bazaar-pay-to";

function readFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim();
  }

  return value?.trim();
}

function getPayToAddress(context: {
  adapter: {
    getHeader(name: string): string | undefined;
    getQueryParam?(name: string): string | string[] | undefined;
  };
}) {
  const queryValue = readFirstValue(
    context.adapter.getQueryParam?.(X402_PAY_TO_QUERY_PARAM),
  );
  const headerValue = context.adapter.getHeader(X402_PAY_TO_HEADER)?.trim();

  return queryValue || headerValue;
}

function createRouteConfig(composition: {
  price: string;
  network: string;
  description: string;
}): RouteConfig {
  return {
    accepts: [
      {
        scheme: "exact",
        price: composition.price,
        network: composition.network as `${string}:${string}`,
        payTo: context => {
          const payToAddress = getPayToAddress(context);
          if (!payToAddress) {
            throw new Error("No x402 payout address was provided for this request.");
          }

          return payToAddress;
        },
      },
    ],
    description: composition.description,
    mimeType: "application/json",
    extensions: {
      bazaar: {
        discoverable: true,
        category: "composite-api",
        tags: ["agent-bazaar", "composite", "ai-powered"],
      },
    },
  };
}

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
  request: NextRequest,
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

  const wrappedHandler = withX402(
    async (): Promise<NextResponse<unknown>> => {
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

      const response = NextResponse.json({
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
      });
      response.headers.set("x-request-id", logContext.requestId);
      return response;
    },
    createRouteConfig(composition),
    getX402Server(composition.network as `${string}:${string}`),
  );

  return wrappedHandler(request);
}
