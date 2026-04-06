"use client";

const DEMO_STEPS = [
  {
    title: "1. Start a conversation",
    body: "Open the Playground tab and ask the agent about x402 services, its wallet capabilities, or market data. The agent is tuned to demonstrate Coinbase CDP products.",
  },
  {
    title: "2. Discover and experiment",
    body: "Ask the agent to discover x402 services, buy one, and analyze the result. This demonstrates machine-native API commerce and live onchain payments.",
  },
  {
    title: "3. Create a composite API",
    body: "After exploring services, click 'Export as x402 API' in the Playground header to auto-generate a composite API from your conversation. Edit and publish it in the Agents tab.",
  },
  {
    title: "4. Manage wallets",
    body: "Visit the Wallets tab to see your embedded wallet and the agent's server wallet side by side. Fund the agent, check multi-token balances, and review transaction history.",
  },
  {
    title: "5. Review the dashboard",
    body: "The Dashboard shows live telemetry of tool executions, x402 payments, and market data.",
  },
];

const REVIEWER_PROMPTS = [
  "Explain this app as if you were pitching it to the Coinbase CDP team in under 60 seconds.",
  "Show my agent wallet details, capabilities, and how they map to Coinbase products.",
  "Discover x402 services under $0.01 that would improve this demo for a reviewer.",
  "Buy one useful paid service and summarize the result in a machine-economy framing.",
  "Help me design a composite API that combines multiple data sources, then I'll export it.",
];

const ARCHITECTURE_POINTS = [
  {
    title: "Embedded Wallet",
    description: "Users sign in with a CDP embedded wallet for direct x402 purchases and onchain interactions.",
  },
  {
    title: "Agent Wallet",
    description: "A server-side AgentKit wallet inspects balances, quotes swaps, and autonomously pays for x402 services.",
  },
  {
    title: "Bidirectional x402",
    description: "Agent Bazaar is both a seller and buyer: it exposes premium APIs and consumes external paid services.",
  },
  {
    title: "API Composer",
    description: "Users create composite x402 endpoints from chat conversations, combining multiple data sources with AI reasoning.",
  },
];

export default function ShowcaseGuide() {
  return (
    <section className="panel showcase-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Help</p>
          <h2 className="panel-title">Guide and Demo Script</h2>
        </div>
      </div>

      <p className="panel-copy">
        Agent Bazaar is a machine-commerce platform that demonstrates embedded wallets,
        autonomous agents, x402 payments, and composable paid APIs -- all built on Coinbase CDP.
      </p>

      <div className="showcase-highlight">
        <strong>One-line pitch</strong>
        <p>
          Agent Bazaar shows how users and autonomous agents can hold wallets,
          discover paid services, transact over x402, and compose new APIs
          using Coinbase CDP primitives in one product.
        </p>
      </div>

      <div className="showcase-grid">
        {ARCHITECTURE_POINTS.map(point => (
          <article key={point.title} className="service-card">
            <strong>{point.title}</strong>
            <p>{point.description}</p>
          </article>
        ))}
      </div>

      <div className="timeline">
        <div className="timeline-header">
          <h3>Getting Started</h3>
          <p>Follow these steps for a complete walkthrough.</p>
        </div>

        <div className="timeline-list">
          {DEMO_STEPS.map(step => (
            <article key={step.title} className="timeline-item">
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="timeline">
        <div className="timeline-header">
          <h3>Suggested Prompts</h3>
          <p>Copy these to the chat for a guided experience.</p>
        </div>

        <div className="starter-list">
          {REVIEWER_PROMPTS.map(prompt => (
            <button
              key={prompt}
              className="starter-chip"
              onClick={() => navigator.clipboard.writeText(prompt)}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
