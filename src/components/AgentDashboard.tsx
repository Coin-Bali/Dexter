"use client";

import { useEffect, useMemo, useState } from "react";

import type { ChatInterfaceMessages } from "@/components/ChatInterface";

export type PremiumPaymentEvent = {
  id: string;
  title: string;
  endpoint: string;
  price: string;
  status: "success" | "error";
  timestamp: string;
  preview?: string;
};

interface AgentDashboardProps {
  userAddress: string | null;
  messages: ChatInterfaceMessages;
  paymentEvents: PremiumPaymentEvent[];
}

type TimelineEvent = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  kind: "tool" | "payment";
  status: string;
};

type DbPaymentEvent = {
  id: string;
  serviceName: string;
  endpoint: string;
  price: string;
  status: string;
  responsePreview: string | null;
  createdAt: string;
};

type DbAgentActivity = {
  id: string;
  toolName: string;
  args: unknown;
  result: unknown;
  status: string;
  createdAt: string;
};

function summarize(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.length <= 140) return text;
  return `${text.slice(0, 140)}...`;
}

export default function AgentDashboard({
  userAddress,
  messages,
  paymentEvents,
}: AgentDashboardProps) {
  const [dbPayments, setDbPayments] = useState<DbPaymentEvent[]>([]);
  const [dbActivities, setDbActivities] = useState<DbAgentActivity[]>([]);

  useEffect(() => {
    if (!userAddress) return;
    let isMounted = true;

    const loadHistory = async () => {
      try {
        const [paymentsRes, activitiesRes] = await Promise.all([
          fetch(`/api/payments?wallet=${encodeURIComponent(userAddress)}&limit=20`, { cache: "no-store" }),
          fetch(`/api/agent-activity?wallet=${encodeURIComponent(userAddress)}&limit=20`, { cache: "no-store" }),
        ]);

        if (isMounted && paymentsRes.ok) {
          const data = await paymentsRes.json();
          setDbPayments(data.events ?? []);
        }
        if (isMounted && activitiesRes.ok) {
          const data = await activitiesRes.json();
          setDbActivities(data.activities ?? []);
        }
      } catch { /* best-effort */ }
    };

    loadHistory();
    const interval = setInterval(loadHistory, 30000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [userAddress]);

  const toolEvents = useMemo<TimelineEvent[]>(() => {
    return messages.flatMap(message =>
      (message.parts ?? [])
        .filter(part => part.type === "tool-invocation")
        .map((part, index) => ({
          id: `${message.id}-tool-${index}`,
          title: part.toolInvocation.toolName,
          detail: part.toolInvocation.state === "result"
            ? summarize(part.toolInvocation.result)
            : summarize(part.toolInvocation.args),
          timestamp: message.createdAt?.toISOString() ?? new Date().toISOString(),
          kind: "tool",
          status: part.toolInvocation.state,
        })),
    );
  }, [messages]);

  const timeline = useMemo<TimelineEvent[]>(() => {
    const paymentTimeline = paymentEvents.map(event => ({
      id: event.id,
      title: event.title,
      detail: event.preview || event.endpoint,
      timestamp: event.timestamp,
      kind: "payment" as const,
      status: event.status,
    }));

    const dbPaymentTimeline = dbPayments
      .filter(p => !paymentEvents.some(pe => pe.endpoint === p.endpoint && pe.timestamp === p.createdAt))
      .map(event => ({
        id: `db-pay-${event.id}`,
        title: event.serviceName,
        detail: event.responsePreview || event.endpoint,
        timestamp: event.createdAt,
        kind: "payment" as const,
        status: event.status,
      }));

    const dbActivityTimeline = dbActivities
      .filter(a => !toolEvents.some(te => te.title === a.toolName && te.timestamp === a.createdAt))
      .map(event => ({
        id: `db-act-${event.id}`,
        title: event.toolName,
        detail: summarize(event.result ?? event.args),
        timestamp: event.createdAt,
        kind: "tool" as const,
        status: event.status,
      }));

    return [...paymentTimeline, ...dbPaymentTimeline, ...toolEvents, ...dbActivityTimeline]
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, 20);
  }, [paymentEvents, dbPayments, toolEvents, dbActivities]);

  const totalPayments = paymentEvents.length + dbPayments.filter(
    p => !paymentEvents.some(pe => pe.endpoint === p.endpoint && pe.timestamp === p.createdAt),
  ).length;

  return (
    <section className="panel dashboard-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2 className="panel-title">Activity and Telemetry</h2>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="metric-card">
          <span className="metric-label">Tool Executions</span>
          <strong className="metric-value">{toolEvents.length + dbActivities.length}</strong>
          <span className="metric-subtle">Wallet, swap, price, and x402 actions</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">x402 Payments</span>
          <strong className="metric-value">{totalPayments}</strong>
          <span className="metric-subtle">Session + historical purchases</span>
        </div>
      </div>

      <div className="timeline">
        <div className="timeline-header">
          <h3>Recent Activity</h3>
          <p>Agent tool calls and x402 purchases from this session and history.</p>
        </div>

        {timeline.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No activity yet</p>
            <p className="empty-state-copy">
              Use the chat or buy a premium endpoint to populate the live feed.
            </p>
          </div>
        ) : (
          <div className="timeline-list">
            {timeline.map(event => (
              <article key={event.id} className="timeline-item">
                <div className="timeline-item-header">
                  <strong>{event.title}</strong>
                  <span className={`status-pill status-pill--${event.status}`}>
                    {event.kind}
                  </span>
                </div>
                <p>{event.detail}</p>
                <span className="timeline-timestamp">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
