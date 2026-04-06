import { createOpenAI } from "@ai-sdk/openai";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { convertToCoreMessages, streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";

import {
  attachRequestIdHeader,
  createRouteLogContext,
  logRouteError,
  logRouteStart,
  logRouteSuccess,
  logRouteWarn,
  maskAddress,
  summarizeText,
} from "@/lib/api-logger";
import { prisma } from "@/lib/db";
import { requireAuthenticatedUser } from "@/lib/session";
import { getDexterPremiumServices } from "@/lib/x402-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LLM_GATEWAY_BASE_URL = "https://llm-gateway.cbhq.net/v1";
const DEFAULT_MODEL =
  process.env.CHAT_LLM_MODEL ?? process.env.LLM_GATEWAY_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.2";

function getLlmGatewayApiKey() {
  return (
    process.env.LLM_GATEWAY_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
}

function getLlmGatewayBaseUrl() {
  return (
    process.env.LLM_GATEWAY_BASE_URL?.trim() || DEFAULT_LLM_GATEWAY_BASE_URL
  );
}

function buildSystemPrompt(agentProfile: unknown) {
  const premiumServices = getDexterPremiumServices();

  return `
You are Agent Bazaar, an autonomous machine-commerce operator built on Coinbase Developer Platform.

Primary goal:
- Help the user showcase strong Coinbase CDP product understanding and implementation quality.

Operating style:
- Be concise, confident, and product-minded.
- When helpful, explicitly map actions to CDP products such as Embedded Wallets, AgentKit, Server Wallet, Pyth, x402, Bazaar, and Onramp/Offramp.
- Prefer tools when the user asks for balances, swaps, market data, service discovery, or paid API access.
- Prefer the minimum number of tool calls needed to answer the question well.
- Start with fast, narrow tool queries before broader discovery.
- If a paid x402 call is useful, tell the user what it costs before you buy it and summarize the value after.
- Never claim a payment, transfer, or swap succeeded unless a tool confirms it.
- When the user asks for a pitch, reviewer summary, or demo narrative, answer in a polished way that sounds like a product demo, not a raw debugging log.

Demo framing:
- Emphasize that Agent Bazaar is both an x402 buyer and x402 seller.
- Emphasize that the agent has its own wallet and can act autonomously.
- Emphasize that the app proves machine-to-machine commerce, not just wallet connection UX.
- Prefer concrete, verifiable statements over hype.

API Composer feature:
- Agent Bazaar lets users create composite x402 APIs directly from the chat.
- After exploring and experimenting with x402 services in this conversation, the user can click "Export as x402 API" in the chat header.
- This analyzes the conversation to auto-generate a draft composition: source APIs, AI reasoning prompt, name, description, and price.
- The draft lands in the Agents tab where the user can review, edit, test, and publish it as a live x402 endpoint.
- When the user asks about building APIs, guide them through exploring services first, then remind them to click "Export as x402 API" when ready.
- Proactively suggest interesting combinations. For example: "Try combining the Agent Bazaar price feed with a Bazaar web intelligence service, then export as an API that gives AI-powered trading signals."
- The more specific the conversation (discovering services, buying them, analyzing results), the better the exported draft will be.

Agent profile:
${JSON.stringify(agentProfile, null, 2)}

Agent Bazaar premium endpoints that other agents can buy:
${JSON.stringify(premiumServices, null, 2)}

Suggested showcase flows:
- Give a 30-60 second reviewer pitch for the app.
- Discover affordable x402 services for crypto data or web intelligence.
- Buy a paid service with USDC and summarize the result.
- Inspect the agent wallet on Base Sepolia, then explain whether it can buy services or quote swaps immediately.
- Quote or execute a swap only after clearly restating the token pair and amount.
- Use Pyth price feeds when the user asks for external market context.
- When discovering x402 services, start with a concise shortlist of the best matches under the user's budget.
- Only expand to broader or more exhaustive discovery if the user explicitly asks for more options.
- Walk the user through discovering services, then suggest they click "Export as x402 API" to turn the conversation into a publishable endpoint.

When giving reviewer-facing summaries, structure them around:
1. What product capability is being demonstrated.
2. What happened technically.
3. Why it matters for the machine economy.
`.trim();
}

async function persistMessage(
  conversationId: string | undefined,
  role: string,
  content: string,
  parts?: unknown,
) {
  if (!conversationId) return;
  try {
    await prisma.message.create({
      data: {
        conversationId,
        role,
        content: content.slice(0, 50000),
        parts: parts ?? undefined,
      },
    });
  } catch {
    // DB writes are best-effort; don't block the chat stream
  }
}

async function logAgentActivity(
  userWallet: string | undefined,
  toolName: string,
  args: unknown,
  result: unknown,
  status: string,
) {
  try {
    await prisma.agentActivity.create({
      data: {
        userWallet: userWallet || null,
        toolName,
        args: args as never,
        result: result as never,
        status,
      },
    });
  } catch {
    // best-effort
  }
}

export async function POST(request: NextRequest) {
  const logContext = createRouteLogContext("/api/chat");
  const {
    getAgentKit,
    getAgentProfile,
    getMissingAgentEnv,
    isAgentConfigured,
  } = await import("@/lib/agentkit");
  try {
    const { user } = await requireAuthenticatedUser(request);
    const body = await request.json();
    const { messages, conversationId } = body;

    logRouteStart(logContext, {
      conversationId: conversationId ?? null,
      walletAddress: maskAddress(user.walletAddress),
      messageCount: Array.isArray(messages) ? messages.length : 0,
      lastUserMessagePreview: summarizeText(
        Array.isArray(messages)
          ? [...messages]
              .reverse()
              .find((message: { role: string; content?: string }) => message.role === "user")
              ?.content
          : null,
        80,
      ),
      model: DEFAULT_MODEL,
    });

    const llmGatewayApiKey = getLlmGatewayApiKey();

    if (!llmGatewayApiKey) {
      logRouteWarn(logContext, "route.missing_llm_api_key");
      return attachRequestIdHeader(
        NextResponse.json(
          {
            error:
              "LLM_GATEWAY_API_KEY is required to use the agent chat. OPENAI_API_KEY is still accepted as a legacy fallback name.",
          },
          { status: 503 },
        ),
        logContext.requestId,
      );
    }

    if (!isAgentConfigured()) {
      logRouteWarn(logContext, "route.agent_not_configured", {
        missingEnv: getMissingAgentEnv(),
      });
      return attachRequestIdHeader(
        NextResponse.json(
          {
            error: "The agent wallet is not configured.",
            missingEnv: getMissingAgentEnv(),
          },
          { status: 503 },
        ),
        logContext.requestId,
      );
    }

    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: user.id,
        },
        select: { id: true },
      });

      if (!conversation) {
        logRouteWarn(logContext, "route.conversation_not_found", {
          conversationId,
          userId: user.id,
        });
        return attachRequestIdHeader(
          NextResponse.json({ error: "Conversation not found." }, { status: 404 }),
          logContext.requestId,
        );
      }

      const lastUserMsg = [...messages].reverse().find(
        (m: { role: string }) => m.role === "user",
      );
      if (lastUserMsg) {
        await persistMessage(
          conversationId,
          "user",
          typeof lastUserMsg.content === "string"
            ? lastUserMsg.content
            : JSON.stringify(lastUserMsg.content),
        );
      }
    }

    const agentKit = await getAgentKit({
      id: user.id,
      walletAddress: user.walletAddress,
      preferredNetwork: user.preferredNetwork,
    });
    const tools = getVercelAITools(agentKit);
    const agentProfile = await getAgentProfile({
      id: user.id,
      walletAddress: user.walletAddress,
      preferredNetwork: user.preferredNetwork,
    });
    const llmGateway = createOpenAI({
      apiKey: llmGatewayApiKey,
      baseURL: getLlmGatewayBaseUrl(),
    });

    const result = streamText({
      model: llmGateway(DEFAULT_MODEL),
      system: buildSystemPrompt(agentProfile),
      messages: convertToCoreMessages(messages, { tools }),
      tools,
    maxSteps: 5,
      toolCallStreaming: true,
      async onFinish({ text, toolCalls, toolResults, finishReason }) {
        if (conversationId && text) {
          await persistMessage(conversationId, "assistant", text);
        }

        if (toolCalls) {
          const results = toolResults as
            | { toolCallId: string; result: unknown }[]
            | undefined;
          for (const call of toolCalls) {
            const matchingResult = results?.find(
              r => r.toolCallId === call.toolCallId,
            );
            await logAgentActivity(
              user.walletAddress,
              call.toolName,
              call.args,
              matchingResult?.result,
              matchingResult ? "result" : "called",
            );
          }
        }

        if (conversationId) {
          const titleWords = text?.split(/\s+/).slice(0, 6).join(" ");
          if (titleWords) {
            await prisma.conversation
              .update({
                where: { id: conversationId },
                data: { title: titleWords },
              })
              .catch(() => {});
          }
        }

        logRouteSuccess(logContext, {
          finishReason,
          toolCallCount: toolCalls?.length ?? 0,
          assistantTextPreview: summarizeText(text, 120),
          agentWalletAddress: maskAddress(agentProfile.address as string | undefined),
        });
      },
    });

    const response = result.toDataStreamResponse();
    return attachRequestIdHeader(response, logContext.requestId);
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
                : "Failed to run chat.",
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
