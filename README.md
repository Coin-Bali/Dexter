# Agent Bazaar

Agent Bazaar is a CDP-native machine commerce platform built with Coinbase Developer Platform, AgentKit, embedded wallets, x402, and Neon Postgres.

## What It Demonstrates

- embedded wallet onboarding plus wallet-signature application auth
- user-scoped agent wallets persisted per user and per network
- x402 buying and selling
- AI-assisted composite API creation from chat conversations
- network-aware wallet balances, tracked assets, and wallet activity
- persistent sessions, conversations, payments, and agent activity

## Main Experience

- `Chat` - persistent AgentKit chat with export-to-API flow
- `Creator` - draft, edit, test, and publish composite x402 APIs
- `Services` - Bazaar discovery plus local premium endpoints
- `Wallets` - user wallet, agent wallet, tracked assets, and activity
- `Dashboard` - telemetry and payment activity
- `Profile` - editable display name, role, preferred network, and theme
- `Help` - showcase guide and demo prompts

## Architecture

### Frontend

- `src/components/ClientApp.tsx` - auth/session gate and app state machine
- `src/components/AuthenticateWalletScreen.tsx` - wallet signature authentication
- `src/components/RegistrationFlow.tsx` - first-run onboarding and preferences
- `src/components/SignedInScreen.tsx` - authenticated shell and route-backed navigation
- `src/components/Sidebar.tsx` - navigation, balance summary, theme switcher
- `src/components/ChatInterface.tsx` - persistent chat, history, export-to-API flow
- `src/components/ApiComposer.tsx` - composition editing and publishing
- `src/components/WalletsPage.tsx` - portfolio, transfers, activity, agent funding
- `src/components/ProfilePage.tsx` - editable profile and stats
- `src/components/ThemeProvider.tsx` - light/dark/system theming

### Server

- `src/app/api/auth/*` - challenge, verify, session, logout
- `src/app/api/chat/route.ts` - authenticated AgentKit + Vercel AI SDK chat
- `src/app/api/services/route.ts` - authenticated service discovery
- `src/app/api/compositions/*` - authenticated composition CRUD + testing
- `src/app/api/wallet/*` - balances, tracked assets, wallet activity
- `src/app/api/agent/profile/route.ts` - user-scoped agent wallet profile
- `src/app/api/agent/transfers/route.ts` - owner-only agent wallet withdrawals

### Core Libraries

- `src/lib/auth.ts` - wallet-auth message, cookie, nonce, hash helpers
- `src/lib/session.ts` - session creation, validation, and cookie management
- `src/lib/networks.ts` - supported network and token registry
- `src/lib/agentkit.ts` - per-user / per-network agent wallet resolution
- `src/lib/x402-actions.ts` - service discovery helpers and local premium metadata
- `src/lib/x402-server.ts` - x402 seller configuration and dynamic composition routes
- `src/lib/api-logger.ts` - structured request logging with request IDs

## Authentication Model

The app uses a two-step model:

1. CDP embedded wallet sign-in
2. wallet-signature verification that creates an authenticated app session cookie

This protects non-x402 APIs from abuse and removes trust in caller-supplied wallet addresses.

## Supported Networks

- `base-sepolia`
- `base`

These preferences are stored per user and used for wallet views, user-scoped agent wallets, service discovery, and profile display.

## Environment Variables

### Core app

- `NEXT_PUBLIC_CDP_PROJECT_ID`
- `BASE_URL`
- `LLM_GATEWAY_API_KEY`
- `DATABASE_URL`

### Agent wallet runtime

- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- `CDP_WALLET_SECRET`

### Optional

- `DATABASE_URL_UNPOOLED`
- `CDP_AGENT_WALLET_ADDRESS`
- `CDP_AGENT_WALLET_IDEMPOTENCY_KEY`
- `CDP_AGENT_RPC_URL`
- `CDP_AGENT_NETWORK`
- `X402_NETWORK`
- `X402_FACILITATOR_URL`
- `X402_PAY_TO_ADDRESS`
- `LLM_GATEWAY_BASE_URL`
- `LLM_GATEWAY_MODEL`
- `COINBASE_API_KEY_ID`
- `COINBASE_API_KEY_SECRET`

## Local Development

```bash
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
```

## Verification

```bash
npm run lint
npm run build
npm run test
```

## Documentation Package

Submission-ready docs live in `docs/`:

- `docs/showcase.md`
- `docs/security.md`
- `docs/testing.md`
- `docs/operations.md`
- `docs/cdp-product-feedback.md`

## Stack

- Next.js 16
- React 19
- TypeScript
- Coinbase CDP React / Hooks / Core
- Coinbase AgentKit
- Vercel AI SDK
- x402 (`@x402/core`, `@x402/next`, `@x402/fetch`, `@x402/evm`, `@x402/extensions`)
- Prisma ORM + Neon Postgres
- viem
- Vitest + Testing Library

## Reference Links

- [Coinbase CDP Docs](https://docs.cdp.coinbase.com/)
- [AgentKit Docs](https://docs.cdp.coinbase.com/agent-kit/welcome)
- [x402 Docs](https://docs.cdp.coinbase.com/x402/welcome)
- [Payments MCP Docs](https://docs.cdp.coinbase.com/payments-mcp/welcome)
