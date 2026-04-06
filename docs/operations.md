# Operations Guide

## Required Setup

- configure CDP embedded wallet project
- configure AgentKit server wallet credentials
- configure Neon Postgres
- configure LLM gateway access

## Database

```bash
npx prisma migrate dev
npx prisma generate
```

## Local Run

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run build
npm run test
```

## Observability

Key app APIs emit structured JSON logs with:

- request ID
- route name
- duration
- safe request metadata
- structured errors

Important routes with logging:

- auth routes
- chat
- composition generation/testing
- services
- wallet balance routes
- agent profile

## Deployment Notes

- set `BASE_URL` to the deployed origin
- keep embedded wallet CORS aligned with the deployed domain
- keep `DATABASE_URL_UNPOOLED` available for Prisma migrations
- if production uses Base mainnet, ensure user network defaults and x402 network defaults are aligned
