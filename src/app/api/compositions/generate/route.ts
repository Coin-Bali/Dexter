import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
  logRouteWarn,
} from "@/lib/api-logger";
import { requireAuthenticatedUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LLM_BASE_URL = "https://llm-gateway.cbhq.net/v1";

const compositionDraftSchema = z.object({
  name: z.string().describe("Short, descriptive name for the composite API endpoint"),
  description: z.string().describe("One-paragraph description of what this endpoint does and why it is valuable"),
  sourceApis: z.array(
    z.object({
      url: z.string().describe("Full URL of the x402 API"),
      method: z.string().describe("HTTP method, usually GET"),
      name: z.string().describe("Human-readable name"),
      description: z.string().describe("What this source provides"),
    }),
  ).describe("The x402 APIs to combine as data sources"),
  aiPrompt: z.string().describe("System prompt that tells the AI how to process and combine the source API results into a unified response"),
  price: z.string().describe("Suggested USDC price like $0.01"),
});

export async function POST(request: NextRequest) {
  const logContext = createRouteLogContext("/api/compositions/generate");
  const llmApiKey =
    process.env.LLM_GATEWAY_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (!llmApiKey) {
    logRouteWarn(logContext, "route.missing_llm_api_key");
    return attachRequestIdHeader(
      NextResponse.json(
        { error: "LLM_GATEWAY_API_KEY not configured" },
        { status: 503 },
      ),
      logContext.requestId,
    );
  }

  await requireAuthenticatedUser(request);
  const body = await request.json();
  const { messages } = body;

  logRouteStart(logContext, {
    messageCount: Array.isArray(messages) ? messages.length : 0,
    model: process.env.LLM_GATEWAY_MODEL ?? "gpt-4o-mini",
  });

  if (!Array.isArray(messages) || messages.length === 0) {
    logRouteWarn(logContext, "route.invalid_messages");
    return attachRequestIdHeader(
      NextResponse.json(
        { error: "messages array is required" },
        { status: 400 },
      ),
      logContext.requestId,
    );
  }

  const conversationSummary = messages
    .map((m: { role: string; content: string; parts?: unknown[] }) => {
      const parts: string[] = [];
      parts.push(`[${m.role}]: ${typeof m.content === "string" ? m.content : ""}`);

      if (m.parts) {
        for (const part of m.parts) {
          const p = part as Record<string, unknown>;
          if (p.type === "tool-invocation") {
            const inv = p.toolInvocation as Record<string, unknown>;
            parts.push(`  [tool: ${inv.toolName}] args=${JSON.stringify(inv.args ?? {}).slice(0, 300)}`);
            if (inv.state === "result") {
              parts.push(`  [result] ${JSON.stringify(inv.result ?? "").slice(0, 500)}`);
            }
          }
        }
      }
      return parts.join("\n");
    })
    .join("\n\n");

  const llm = createOpenAI({
    apiKey: llmApiKey,
    baseURL: process.env.LLM_GATEWAY_BASE_URL?.trim() || DEFAULT_LLM_BASE_URL,
  });

  try {
    const result = await generateObject({
      model: llm(process.env.LLM_GATEWAY_MODEL ?? "gpt-4o-mini"),
      schema: compositionDraftSchema,
      prompt: `You are an API composition architect for Agent Bazaar, a machine-commerce platform that uses x402 paid APIs.

Analyze the following conversation between a user and the Agent Bazaar agent. The user has been exploring, discovering, and experimenting with x402 paid services. Your job is to extract a composition blueprint -- a new x402 API endpoint the user can publish that combines multiple source APIs with AI reasoning.

CONVERSATION:
${conversationSummary}

Based on this conversation, create a composite API specification:

1. Identify which x402 APIs were discussed, discovered, or purchased. Include them as sourceApis. If the conversation mentions specific API URLs from tool results, use those exact URLs. If only general categories were discussed, use reasonable public endpoints or Agent Bazaar's own premium endpoints (like /api/x402/price-feed or /api/x402/agent-insight).

2. Write an aiPrompt that describes how the AI should combine and analyze the data from all sources. The prompt should reflect the user's intent from the conversation.

3. Choose a descriptive name and rich description.

4. Suggest a price. For simple data combinations use $0.005-$0.01. For complex multi-source analysis use $0.01-$0.05.

Return a complete, ready-to-edit composition draft.`,
      maxTokens: 2000,
    });

    logRouteSuccess(logContext, {
      sourceApiCount: result.object.sourceApis.length,
      draftName: result.object.name,
    });

    return attachRequestIdHeader(
      NextResponse.json({ draft: result.object }),
      logContext.requestId,
    );
  } catch (error) {
    logRouteError(logContext, error);
    return attachRequestIdHeader(
      NextResponse.json(
        {
          error:
            error instanceof Error && error.message === "UNAUTHENTICATED"
              ? "Authentication required."
              : error instanceof Error
                ? error.message
                : "Failed to generate composition draft",
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
