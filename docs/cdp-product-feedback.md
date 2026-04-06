# CDP Product Feedback

## Cross-Product Cohesion

### Friction points

- Getting different CDP products to work together is still not straightforward. Each product (Embedded Wallets, AgentKit, x402, Onramp/Offramp) has its own setup, configuration, and mental model. Connecting them into a cohesive application requires significant glue code and undocumented integration patterns.
- There is no unified session or identity layer across CDP products. An app that uses Embedded Wallets for user auth, AgentKit for server-side agents, and x402 for paid API access must build its own session middleware, wallet-scoping logic, and network-consistency layer from scratch.
- Network configuration must be manually kept in sync across all products. A user's preferred network in the embedded wallet must be threaded through to AgentKit wallet creation, x402 middleware, Onramp eligibility, and Bazaar discovery -- there is no shared config abstraction.
- Composing x402 paid APIs with AgentKit tools currently requires custom orchestration. There is no built-in pattern for an agent to discover, evaluate, and pay for an x402 service as part of its tool execution loop.

### Suggested improvements

- A unified CDP app SDK or configuration layer that initialises all products from a single config (network, auth, wallet preferences).
- First-class "CDP App Session" middleware that links the embedded wallet identity to server-side AgentKit wallets, x402 payment credentials, and Onramp/Offramp eligibility in one abstraction.
- A shared network-context provider that propagates the user's selected network to every CDP primitive without manual threading.
- Built-in AgentKit tools for x402 service discovery and payment so agents can natively participate in the machine economy without custom tool wiring.

## Embedded Wallets

### Friction points

- The app still needs a separate application-session layer for protecting server APIs.
- Embedded wallet sign-in alone is not enough for a production-grade app that stores user data and exposes protected backend routes.

### Suggested improvements

- First-class SIWE or wallet-session helpers in the CDP React stack.
- Built-in server-verifiable session middleware patterns for Next.js.

## AgentKit

### Friction points

- User-scoped server wallets require custom persistence and scoping logic.
- The app had to evolve from a single global wallet model to a per-user, per-network model.
- Wiring AgentKit tools to interact with x402 services requires implementing custom tool definitions and payment flows that should be standardized.

### Suggested improvements

- First-class multi-tenant wallet patterns.
- Explicit docs for user-scoped vs app-scoped agent wallets.
- Simpler recovery/persistence primitives for app restarts.
- Native AgentKit x402 tools: `discover_x402_services`, `buy_x402_service`, `publish_x402_service`.

## x402

### Friction points

- Local premium route protection and UI-level network selection can drift if network choice is not explicitly shared between the app shell and middleware.
- Bazaar discovery is powerful but the API is hard to use for building rich discovery UIs. Name-based search alone makes it difficult to find services -- developers need category, tag, price-range, and semantic search out of the box.
- No built-in pattern for agentic x402 API discovery. Autonomous agents need structured metadata (input/output schemas, SLA guarantees, reliability scores) to programmatically evaluate and select services.

### Suggested improvements

- Stronger patterns for request-time network selection in framework middleware.
- Richer discovery APIs with native pagination, category/tag facets, and price-range filters optimized for both human UIs and agentic consumption.
- Machine-readable service descriptors (OpenAPI-like schemas) registered alongside x402 resources so agents can auto-evaluate compatibility.
- A discovery ranking/scoring API that lets agents query "best service for task X under budget Y" without downloading the full catalog.

## Onramp / Offramp

### Friction points

- Developer UX is strongest for mainnet flows; testnet-oriented product demos need clearer patterns and guidance.
- No programmatic way to check Onramp/Offramp eligibility for a given user+network combination before rendering the UI.

### Suggested improvements

- Better documentation for how to represent funding/offramp UX in testnet-first demos.
- Clearer guidance on mapping preferred user network to supported fiat ramps.
- An eligibility-check API so the app can conditionally show funding options.

## RPC / Asset Tracking

### Friction points

- Building a wallet-like portfolio view still requires app developers to manually curate token lists and contract metadata.
- No CDP-native way to get a unified activity feed across embedded wallet and server wallet transactions.

### Suggested improvements

- Higher-level portfolio APIs through CDP for common supported assets.
- Built-in user wallet + server wallet asset/activity abstractions.
- A combined transaction history endpoint that merges embedded and agent wallet activity.

## Implementation Pain Points

### Authentication & Session Management

- Building a secure session layer on top of embedded wallet sign-in required implementing SIWE verification, cookie-based sessions, and CSRF protection manually. This is boilerplate that every CDP app needs.
- The boundary between "wallet is connected" and "user is authenticated with the backend" is a common source of bugs. CDP should own this boundary.

### Multi-Product Wiring

- Each CDP product has different initialization patterns (client-side hooks for wallets, server-side SDK for AgentKit, middleware for x402). Coordinating startup order and error handling across all three is fragile.
- Environment variable proliferation: a typical CDP app needs 10+ env vars across products. A single CDP config file or dashboard that generates the complete env would reduce setup errors.

### Testing & Development

- No CDP-provided test fixtures or mocks for x402 payment flows. Integration testing requires hitting live Bazaar endpoints or building custom mocks.
- AgentKit server wallet operations are difficult to test in isolation because they depend on network state and wallet funding.
- Testnet USDC funding for x402 payments is a manual process that slows down development iteration.

### Developer Experience

- Error messages from CDP SDKs often lack actionable context. A failed x402 payment returns a generic HTTP 402 without indicating whether the issue is insufficient funds, wrong network, or an expired payment token.
- Documentation examples tend to show each product in isolation. Real-world apps that combine 3-4 CDP products would benefit from end-to-end reference architectures.
- Upgrading CDP SDK versions sometimes introduces subtle breaking changes in hook behavior or middleware signatures that are not covered in migration guides.
