"use client";

import { useChat } from "ai/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CompositionDraft } from "@/lib/composition-types";

export type ChatInterfaceMessages = ReturnType<typeof useChat>["messages"];

interface ChatInterfaceProps {
  onMessagesChange?: (messages: ChatInterfaceMessages) => void;
  onExportAsApi?: (draft: CompositionDraft) => void;
}

type ConversationSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  messages?: { content: string; role: string }[];
};

const STARTER_PROMPTS = [
  "Discover x402 services for crypto market data under $0.01 and explain which ones I should combine into a new API.",
  "Help me design a composite x402 API that combines price feeds with market intelligence. Walk me through what sources to use.",
  "Buy the Agent Bazaar price feed and analyze the data, then suggest how I could enhance it with additional sources into a new paid endpoint.",
  "Show me the agent wallet details and what x402 services are available, then recommend a creative API I could build and publish.",
  "Pitch this app to the Coinbase CDP team in under 60 seconds, then show the strongest technical proof points.",
];

function formatToolName(name: string) {
  return name
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function formatObject(value: unknown) {
  if (value === undefined) {
    return "(no data yet)";
  }

  const serialized = (() => {
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2) ?? String(value);
    } catch {
      return String(value);
    }
  })();

  if (serialized.length <= 480) {
    return serialized;
  }

  return `${serialized.slice(0, 480)}...`;
}

export default function ChatInterface({ onMessagesChange, onExportAsApi }: ChatInterfaceProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationPage, setConversationPage] = useState(1);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const lastMirroredMessageKeyRef = useRef<string>("");

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    setInput,
    setMessages,
    error,
    status,
  } = useChat({
    api: "/api/chat",
    maxSteps: 6,
    body: {
      conversationId: activeConversationId,
    },
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      setLastRequestId(response.headers.get("x-request-id"));
      return response;
    },
  });

  const messageMirrorKey = useMemo(
    () =>
      messages
        .map(message => `${message.id}:${message.role}:${message.content.length}:${message.parts?.length ?? 0}`)
        .join("|"),
    [messages],
  );

  useEffect(() => {
    if (!onMessagesChange) {
      return;
    }

    if (lastMirroredMessageKeyRef.current === messageMirrorKey) {
      return;
    }

    lastMirroredMessageKeyRef.current = messageMirrorKey;
    onMessagesChange(messages);
  }, [messageMirrorKey, messages, onMessagesChange]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/conversations?page=${conversationPage}&pageSize=10&search=${encodeURIComponent(conversationSearch)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      setConversations(data.conversations ?? []);
      setConversationTotal(data.total ?? 0);
    } catch {
      // best-effort
    }
  }, [conversationPage, conversationSearch]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!isMounted) return;
      try {
        const res = await fetch(
          `/api/conversations?page=${conversationPage}&pageSize=10&search=${encodeURIComponent(conversationSearch)}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (isMounted) {
          setConversations(data.conversations ?? []);
          setConversationTotal(data.total ?? 0);
        }
      } catch {
        // best-effort
      }
    })();
    return () => { isMounted = false; };
  }, [conversationPage, conversationSearch]);

  const startNewConversation = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setActiveConversationId(data.conversation.id);
      setMessages([]);
      setSidebarOpen(false);
      loadConversations();
    } catch {
      // best-effort
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (data.conversation?.messages) {
        const restored = data.conversation.messages.map(
          (msg: { id: string; role: string; content: string; parts?: unknown }) => ({
            id: msg.id,
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }),
        );
        setMessages(restored);
      }
      setActiveConversationId(id);
      setSidebarOpen(false);
    } catch {
      // best-effort
    }
  };

  const deleteConversation = async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {});
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
    }
    loadConversations();
  };

  const exportAsApi = async () => {
    if (messages.length < 2 || !onExportAsApi) return;
    setExporting(true);
    try {
      const res = await fetch("/api/compositions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            parts: m.parts,
          })),
        }),
      });
      const data = await res.json();
      if (data.draft) {
        onExportAsApi(data.draft);
      }
    } catch {
      // best-effort
    } finally {
      setExporting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversationId) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        setActiveConversationId(data.conversation.id);
        loadConversations();
      } catch {
        // best-effort - continue without persistence
      }
    }
    handleSubmit(e);
  };

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Playground</p>
          <h2 className="panel-title">Talk to the machine-economy operator</h2>
        </div>
        <div className="chat-header-actions">
          {messages.length >= 2 && onExportAsApi && (
            <button
              className="export-api-button"
              onClick={exportAsApi}
              disabled={exporting || status !== "ready"}
              type="button"
            >
              {exporting ? "Generating..." : "Export as x402 API"}
            </button>
          )}
          <button
            className="secondary-button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            type="button"
          >
            {sidebarOpen ? "Close history" : "History"}
          </button>
          <button className="secondary-button" onClick={startNewConversation} type="button">
            New chat
          </button>
          <span className={`status-pill status-pill--${status}`}>
            {status === "ready" ? "Ready" : status}
          </span>
        </div>
      </div>

      {sidebarOpen && (
        <div className="conversation-sidebar">
          <div className="conversation-sidebar-header">
            <strong>Past conversations</strong>
          </div>
          <div className="conversation-sidebar-search">
            <input
              className="composer-input"
              type="text"
              value={conversationSearch}
              onChange={event => {
                setConversationSearch(event.target.value);
                setConversationPage(1);
              }}
              placeholder="Search conversations"
            />
          </div>
          {conversations.length === 0 ? (
            <p className="panel-copy">No previous conversations yet.</p>
          ) : (
            <>
              <div className="conversation-list">
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`conversation-item ${activeConversationId === conv.id ? "conversation-item--active" : ""}`}
                  >
                    <button
                      className="conversation-item-button"
                      onClick={() => loadConversation(conv.id)}
                      type="button"
                    >
                      <span className="conversation-item-title">
                        {conv.title || "Untitled chat"}
                      </span>
                      <span className="conversation-item-date">
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </span>
                    </button>
                    <button
                      className="conversation-delete-button"
                      onClick={() => deleteConversation(conv.id)}
                      type="button"
                      aria-label="Delete conversation"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              {conversationTotal > 10 && (
                <div className="services-pagination" style={{ marginTop: "0.75rem" }}>
                  <button
                    className="secondary-button"
                    disabled={conversationPage === 1}
                    onClick={() => setConversationPage(page => Math.max(page - 1, 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <span className="services-pagination-info">
                    Page {conversationPage} of {Math.max(Math.ceil(conversationTotal / 10), 1)}
                  </span>
                  <button
                    className="secondary-button"
                    disabled={conversationPage >= Math.ceil(conversationTotal / 10)}
                    onClick={() => setConversationPage(page => page + 1)}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <p className="panel-copy">
        Ask the agent to inspect its wallet, discover paid x402 services, buy
        premium API access, quote an onchain swap, or suggest composite API ideas
        for the Agents tab.
      </p>

      {messages.length === 0 && (
        <div className="starter-list">
          {STARTER_PROMPTS.map(prompt => (
            <button
              key={prompt}
              className="starter-chip"
              onClick={() => setInput(prompt)}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="chat-thread">
        {messages.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-title">No messages yet</p>
            <p className="empty-state-copy">
              Start with a reviewer pitch, a wallet check, an x402 discovery request,
              or ask for composite API ideas you can export to the Agents tab.
            </p>
          </div>
        )}

        {messages.map(message => (
          <article
            key={message.id}
            className={`chat-message chat-message--${message.role}`}
          >
            <div className="chat-message-meta">
              <span>{message.role === "user" ? "You" : "Agent Bazaar"}</span>
            </div>

            <div className="chat-message-body">
              {message.parts?.length ? (
                message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <p key={`${message.id}-text-${index}`} className="message-text">
                        {part.text}
                      </p>
                    );
                  }

                  if (part.type === "tool-invocation") {
                    const invocation = part.toolInvocation;

                    return (
                      <div
                        key={`${message.id}-tool-${index}`}
                        className="tool-call-card"
                      >
                        <div className="tool-call-header">
                          <strong>{formatToolName(invocation.toolName)}</strong>
                          <span className="tool-call-state">{invocation.state}</span>
                        </div>
                        {"args" in invocation && (
                          <pre className="tool-call-code">
                            {formatObject(invocation.args)}
                          </pre>
                        )}
                        {"result" in invocation && invocation.state === "result" && (
                          <pre className="tool-call-code">
                            {formatObject(invocation.result)}
                          </pre>
                        )}
                      </div>
                    );
                  }

                  if (part.type === "reasoning") {
                    return (
                      <details
                        key={`${message.id}-reasoning-${index}`}
                        className="reasoning-block"
                      >
                        <summary>Reasoning trace</summary>
                        <pre>{part.reasoning}</pre>
                      </details>
                    );
                  }

                  if (part.type === "step-start") {
                    return (
                      <div
                        key={`${message.id}-step-${index}`}
                        className="step-divider"
                      >
                        Agent step
                      </div>
                    );
                  }

                  return null;
                })
              ) : (
                <p className="message-text">{message.content}</p>
              )}
            </div>
          </article>
        ))}
      </div>

      {error && (
        <div className="inline-error">
          <strong>Agent unavailable.</strong> {error.message}
          {lastRequestId && (
            <div style={{ marginTop: "0.5rem", fontFamily: "monospace", fontSize: "0.78rem" }}>
              Request ID: {lastRequestId}
            </div>
          )}
          <div style={{ marginTop: "0.5rem" }}>
            <button
              className="secondary-button"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload chat
            </button>
          </div>
        </div>
      )}

      <form className="chat-form" onSubmit={handleFormSubmit}>
        <textarea
          className="chat-input"
          name="prompt"
          onChange={handleInputChange}
          placeholder="Ask the agent to discover x402 services, buy data, inspect wallets, or suggest composite API ideas..."
          rows={4}
          value={input}
        />
        <div className="chat-form-actions">
          <p className="chat-form-copy">
            The agent can use CDP wallet, price, swap, and x402 discovery tools,
            and it is tuned to explain why each action matters in a reviewer demo.
          </p>
          <button className="primary-button" disabled={status !== "ready"} type="submit">
            {status === "ready" ? "Send to agent" : "Working..."}
          </button>
        </div>
      </form>
    </section>
  );
}
