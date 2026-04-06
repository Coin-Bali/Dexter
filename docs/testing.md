# Testing Strategy

## Current Automated Coverage

The project now includes a lightweight Vitest setup focused on high-value tests:

- auth helper tests
- network registry tests
- onboarding UI smoke test

## Commands

```bash
npm run test
npm run test:watch
npm run lint
npm run build
```

## What is covered

- wallet auth message generation
- cookie parsing
- network preference and token registry behavior
- onboarding button enablement / basic UI rendering

## What is intentionally not automated yet

- full embedded wallet sign-in automation
- live AgentKit tool execution against external services
- full x402 payment flow with real wallet settlement

Those flows are better suited to manual demo verification or dedicated environment-backed end-to-end tests once the product surface stabilizes further.
