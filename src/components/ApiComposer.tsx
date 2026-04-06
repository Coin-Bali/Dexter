"use client";

import { useEvmAddress } from "@coinbase/cdp-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { CompositionDraft } from "@/lib/composition-types";
import type { MachineEconomyService } from "@/lib/x402-actions";

type CompositionSourceApi = {
  url: string;
  method: string;
  name: string;
  description: string;
};

type Composition = {
  id: string;
  name: string;
  description: string;
  slug: string;
  price: string;
  isPublished: boolean;
  sourceApis: CompositionSourceApi[];
  aiPrompt: string;
  aiModel: string;
  network: string;
  createdAt: string;
  updatedAt: string;
  _count?: { calls: number };
};

type ServicesResponse = {
  network: string;
  bazaarServices: MachineEconomyService[];
  dexterPremiumServices: MachineEconomyService[];
};

type TestResult = {
  testMode: boolean;
  composition: { id: string; name: string; slug: string };
  sourceResults: {
    name: string;
    url: string;
    ok: boolean;
    status: number;
    data: unknown;
    latencyMs: number;
  }[];
  aiResponse: string | null;
  error?: string;
  latencyMs: number;
};

type ComposerStep = "sources" | "prompt" | "metadata" | "test" | "review";

const PROMPT_TEMPLATES = [
  {
    label: "Market Intelligence Analyst",
    prompt: `You are a market intelligence analyst. Analyze the provided data sources and deliver a concise report including:
1. Key market indicators and their current state
2. Notable trends or anomalies
3. Actionable insights for traders
4. Risk factors to monitor
Keep the analysis data-driven and avoid speculation.`,
  },
  {
    label: "Cross-Source Data Synthesizer",
    prompt: `You are a data synthesis engine. Given multiple API data sources, your job is to:
1. Extract the most important data points from each source
2. Find correlations and contradictions between sources
3. Produce a unified summary that captures the full picture
4. Highlight data quality issues if any source returned errors
Format the output as structured JSON with clear sections.`,
  },
  {
    label: "Machine Economy Advisor",
    prompt: `You are a machine-economy advisor for autonomous agents. Based on the provided data:
1. Assess which data is most valuable for agent decision-making
2. Suggest optimal next actions an agent could take
3. Rate the confidence level of each recommendation
4. Estimate the cost-benefit ratio of acting on this data
Respond in a format that another AI agent can easily parse and act upon.`,
  },
];

interface ApiComposerProps {
  draft?: CompositionDraft | null;
  onDraftConsumed?: () => void;
}

function truncatePreview(value: unknown, maxLen = 300): string {
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}

function extractCategories(services: MachineEconomyService[]): string[] {
  const categories = new Set<string>();
  for (const s of services) {
    if (s.category) categories.add(s.category);
  }
  return Array.from(categories).sort();
}

function extractTags(services: MachineEconomyService[]): string[] {
  const tagCounts = new Map<string, number>();
  for (const s of services) {
    for (const tag of s.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag]) => tag);
}

export default function ApiComposer({ draft, onDraftConsumed }: ApiComposerProps) {
  const { evmAddress } = useEvmAddress();

  const [step, setStep] = useState<ComposerStep>("sources");
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [availableServices, setAvailableServices] = useState<MachineEconomyService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  const [selectedSources, setSelectedSources] = useState<CompositionSourceApi[]>([]);
  const [aiPrompt, setAiPrompt] = useState(PROMPT_TEMPLATES[0].prompt);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("$0.01");

  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compositionSearch, setCompositionSearch] = useState("");
  const [compositionPage, setCompositionPage] = useState(1);
  const [compositionTotal, setCompositionTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  const [modalTag, setModalTag] = useState<string | null>(null);
  const [modalSource, setModalSource] = useState<"all" | "dexter" | "bazaar">("all");

  const loadCompositions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/compositions?page=${compositionPage}&pageSize=9&search=${encodeURIComponent(compositionSearch)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      setCompositions(data.compositions ?? []);
      setCompositionTotal(data.total ?? 0);
    } catch {
      // best-effort
    }
  }, [compositionPage, compositionSearch]);

  const loadServices = useCallback(async () => {
    if (!evmAddress) return;
    setLoadingServices(true);
    try {
      const res = await fetch(
        `/api/services?payTo=${encodeURIComponent(evmAddress)}`,
        { cache: "no-store" },
      );
      const data: ServicesResponse = await res.json();
      setAvailableServices([
        ...data.dexterPremiumServices,
        ...data.bazaarServices,
      ]);
    } catch {
      // best-effort
    } finally {
      setLoadingServices(false);
    }
  }, [evmAddress]);

  useEffect(() => {
    loadCompositions();
    loadServices();
  }, [loadCompositions, loadServices]);

  useEffect(() => {
    if (!draft) return;
    const merged = mergeSourcesWithAvailable(draft.sourceApis, availableServices);
    setSelectedSources(merged);
    setAiPrompt(draft.aiPrompt);
    setName(draft.name);
    setDescription(draft.description);
    setPrice(draft.price);
    setEditing(null);
    setStep("review");
    setTestResult(null);
    setError(null);
    onDraftConsumed?.();
  }, [draft, onDraftConsumed, availableServices]);

  const categories = useMemo(() => extractCategories(availableServices), [availableServices]);
  const topTags = useMemo(() => extractTags(availableServices), [availableServices]);

  const filteredModalServices = useMemo(() => {
    let filtered = availableServices;

    if (modalSource === "dexter") {
      filtered = filtered.filter(s => s.source === "dexter");
    } else if (modalSource === "bazaar") {
      filtered = filtered.filter(s => s.source === "bazaar");
    }

    if (modalCategory) {
      filtered = filtered.filter(s => s.category === modalCategory);
    }

    if (modalTag) {
      filtered = filtered.filter(s => s.tags.includes(modalTag));
    }

    if (modalSearch.trim()) {
      const query = modalSearch.toLowerCase();
      filtered = filtered.filter(s => {
        const haystack = [s.name, s.description, s.category ?? "", ...s.tags, s.url].join(" ").toLowerCase();
        return haystack.includes(query);
      });
    }

    return filtered;
  }, [availableServices, modalSearch, modalCategory, modalTag, modalSource]);

  const addSource = (service: MachineEconomyService) => {
    const already = selectedSources.some(s => s.url === service.url);
    if (already) return;
    setSelectedSources(prev => [
      ...prev,
      {
        url: service.url,
        method: service.method,
        name: service.name,
        description: service.description,
      },
    ]);
  };

  const removeSource = (url: string) => {
    setSelectedSources(prev => prev.filter(s => s.url !== url));
  };

  const resetForm = () => {
    setStep("sources");
    setSelectedSources([]);
    setAiPrompt(PROMPT_TEMPLATES[0].prompt);
    setName("");
    setDescription("");
    setPrice("$0.01");
    setTestResult(null);
    setError(null);
    setEditing(null);
  };

  const editComposition = (comp: Composition) => {
    setEditing(comp.id);
    setSelectedSources(comp.sourceApis);
    setAiPrompt(comp.aiPrompt);
    setName(comp.name);
    setDescription(comp.description);
    setPrice(comp.price);
    setStep("sources");
    setTestResult(null);
    setError(null);
  };

  const saveComposition = async () => {
    if (!evmAddress) return;
    setSaving(true);
    setError(null);

    try {
      if (editing) {
        const res = await fetch(`/api/compositions/${editing}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            sourceApis: selectedSources,
            aiPrompt,
            price,
          }),
        });
        if (!res.ok) throw new Error("Failed to update composition");
      } else {
        const res = await fetch("/api/compositions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            sourceApis: selectedSources,
            aiPrompt,
            price,
          }),
        });
        if (!res.ok) throw new Error("Failed to create composition");
      }

      await loadCompositions();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const testComposition = async (compositionId: string) => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/compositions/${compositionId}/test`, {
        method: "POST",
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  const togglePublish = async (compositionId: string, publish: boolean) => {
    try {
      await fetch(`/api/compositions/${compositionId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish }),
      });
      await loadCompositions();
    } catch {
      setError("Failed to update publish status");
    }
  };

  const deleteComposition = async (compositionId: string) => {
    try {
      await fetch(`/api/compositions/${compositionId}`, { method: "DELETE" });
      await loadCompositions();
    } catch {
      setError("Failed to delete composition");
    }
  };

  const openModal = () => {
    setModalSearch("");
    setModalCategory(null);
    setModalTag(null);
    setModalSource("all");
    setModalOpen(true);
  };

  const canProceedToPrompt = selectedSources.length >= 1;
  const canProceedToMetadata = aiPrompt.trim().length >= 10;
  const canSave = name.trim().length >= 1 && description.trim().length >= 3;

  return (
    <section className="panel composer-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Agents</p>
          <h2 className="panel-title">Build composite x402 endpoints</h2>
        </div>
        {step !== "sources" && (
          <button className="secondary-button" onClick={resetForm} type="button">
            Start over
          </button>
        )}
      </div>

      <p className="panel-copy">
        Create composite x402 endpoints by chatting in the Playground and clicking
        &ldquo;Export as x402 API&rdquo;, or build one manually by adding sources below.
      </p>

      {error && <div className="inline-error">{error}</div>}

      {/* Existing compositions list */}
      {compositions.length > 0 && step === "sources" && !editing && (
        <div className="composer-existing">
          <div className="timeline-header">
            <h3>Your compositions</h3>
            <p>Manage your existing composite x402 endpoints.</p>
          </div>
          <div className="services-search-row" style={{ marginBottom: "0.75rem" }}>
            <input
              className="composer-input"
              type="text"
              value={compositionSearch}
              onChange={event => {
                setCompositionSearch(event.target.value);
                setCompositionPage(1);
              }}
              placeholder="Search compositions"
            />
          </div>
          <div className="service-grid">
            {compositions.map(comp => (
              <article key={comp.id} className="service-card">
                <div className="service-card-header">
                  <strong>{comp.name}</strong>
                  <span className="service-price">{comp.price}</span>
                </div>
                <p>{comp.description}</p>
                <div className="service-meta">
                  <span>{comp.sourceApis.length} sources</span>
                  <span>{comp._count?.calls ?? 0} calls</span>
                  <span className={`status-pill status-pill--${comp.isPublished ? "success" : "ready"}`}>
                    {comp.isPublished ? "Published" : "Draft"}
                  </span>
                </div>
                {comp.isPublished && (
                  <p className="composer-endpoint-url">
                    /api/x402/custom/{comp.slug}
                  </p>
                )}
                <div className="service-actions">
                  <button
                    className="primary-button"
                    onClick={() => togglePublish(comp.id, !comp.isPublished)}
                    type="button"
                  >
                    {comp.isPublished ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => testComposition(comp.id)}
                    disabled={testing}
                    type="button"
                  >
                    {testing ? "Testing..." : "Test"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => editComposition(comp)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => deleteComposition(comp.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          {compositionTotal > 9 && (
            <div className="services-pagination" style={{ marginTop: "0.75rem" }}>
              <button
                className="secondary-button"
                disabled={compositionPage === 1}
                onClick={() => setCompositionPage(page => Math.max(page - 1, 1))}
                type="button"
              >
                Previous
              </button>
              <span className="services-pagination-info">
                Page {compositionPage} of {Math.max(Math.ceil(compositionTotal / 9), 1)}
              </span>
              <button
                className="secondary-button"
                disabled={compositionPage >= Math.ceil(compositionTotal / 9)}
                onClick={() => setCompositionPage(page => page + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Test result display */}
      {testResult && (
        <div className="response-preview">
          <div className="timeline-header">
            <h3>Test result: {testResult.composition.name}</h3>
            <p>Latency: {testResult.latencyMs}ms</p>
          </div>
          {testResult.sourceResults.map((sr, i) => (
            <div key={i} className="test-source-result">
              <strong>
                {sr.name} {sr.ok ? "(OK)" : `(${sr.status})`}
              </strong>
              <pre>{truncatePreview(sr.data)}</pre>
            </div>
          ))}
          {testResult.aiResponse && (
            <div className="test-ai-result">
              <strong>AI Analysis</strong>
              <pre>{testResult.aiResponse}</pre>
            </div>
          )}
          {testResult.error && (
            <div className="inline-error">{testResult.error}</div>
          )}
          <button
            className="secondary-button"
            onClick={() => setTestResult(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step indicators */}
      <div className="composer-steps">
        {(["sources", "prompt", "metadata", "review"] as const).map((s, i) => (
          <button
            key={s}
            className={`composer-step-indicator ${step === s ? "composer-step-indicator--active" : ""}`}
            onClick={() => {
              if (s === "sources") setStep(s);
              else if (s === "prompt" && canProceedToPrompt) setStep(s);
              else if (s === "metadata" && canProceedToPrompt && canProceedToMetadata) setStep(s);
              else if (s === "review" && canProceedToPrompt && canProceedToMetadata && canSave) setStep(s);
            }}
            type="button"
          >
            <span className="composer-step-number">{i + 1}</span>
            <span className="composer-step-label">
              {s === "sources" ? "Sources" : s === "prompt" ? "AI Prompt" : s === "metadata" ? "Details" : "Review"}
            </span>
          </button>
        ))}
      </div>

      {/* Step 1: Select source APIs */}
      {step === "sources" && (
        <div className="composer-step-content">
          <div className="timeline-header">
            <h3>Select data sources</h3>
            <p>Choose x402 APIs to feed into your composite endpoint. Select at least one.</p>
          </div>

          {/* Selected sources displayed as cards */}
          {selectedSources.length > 0 && (
            <div className="composer-source-cards">
              {selectedSources.map(s => (
                <div key={s.url} className="composer-source-card">
                  <div className="composer-source-card-header">
                    <strong>{s.name}</strong>
                    <button
                      className="composer-source-remove"
                      onClick={() => removeSource(s.url)}
                      type="button"
                      aria-label={`Remove ${s.name}`}
                    >
                      &times;
                    </button>
                  </div>
                  <p className="composer-source-card-desc">{s.description}</p>
                  <span className="composer-source-card-url">{s.method} {s.url.length > 50 ? `${s.url.slice(0, 50)}...` : s.url}</span>
                </div>
              ))}
            </div>
          )}

          {selectedSources.length === 0 && (
            <div className="empty-state" style={{ minHeight: "6rem" }}>
              <p className="empty-state-title">No sources added yet</p>
              <p className="empty-state-copy">Click &ldquo;Add Source&rdquo; to browse and select x402 APIs.</p>
            </div>
          )}

          <div className="service-actions">
            <button
              className="secondary-button"
              onClick={openModal}
              disabled={loadingServices}
              type="button"
            >
              {loadingServices ? "Loading services..." : `+ Add Source (${availableServices.length} available)`}
            </button>
            <button
              className="primary-button"
              disabled={!canProceedToPrompt}
              onClick={() => setStep("prompt")}
              type="button"
            >
              Next: Configure AI reasoning
            </button>
          </div>
        </div>
      )}

      {/* Source selection modal */}
      {modalOpen && (
        <div
          className="composer-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
          onKeyDown={e => e.key === "Escape" && setModalOpen(false)}
          role="presentation"
        >
          <div className="composer-modal">
            <div className="composer-modal-header">
              <h3>Browse x402 APIs</h3>
              <button
                className="composer-source-remove"
                onClick={() => setModalOpen(false)}
                type="button"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Search bar */}
            <input
              className="composer-input"
              type="text"
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
              placeholder="Search by name, description, URL, or tags..."
              autoFocus
            />

            {/* Filters */}
            <div className="composer-modal-filters">
              {/* Source tabs */}
              <div className="services-tab-row">
                {(["all", "dexter", "bazaar"] as const).map(tab => (
                  <button
                    key={tab}
                    className={`services-filter-tab ${modalSource === tab ? "services-filter-tab--active" : ""}`}
                    onClick={() => setModalSource(tab)}
                    type="button"
                  >
                    {tab === "all" ? "All" : tab === "dexter" ? "Agent Bazaar" : "Bazaar"}
                  </button>
                ))}
              </div>

              {/* Category filter */}
              {categories.length > 0 && (
                <div className="composer-modal-filter-group">
                  <span className="composer-modal-filter-label">Category</span>
                  <div className="composer-modal-tag-list">
                    <button
                      className={`service-tag service-tag--filter ${!modalCategory ? "service-tag--active" : ""}`}
                      onClick={() => setModalCategory(null)}
                      type="button"
                    >
                      All
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        className={`service-tag service-tag--filter ${modalCategory === cat ? "service-tag--active" : ""}`}
                        onClick={() => setModalCategory(prev => prev === cat ? null : cat)}
                        type="button"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tag filter */}
              {topTags.length > 0 && (
                <div className="composer-modal-filter-group">
                  <span className="composer-modal-filter-label">Tags</span>
                  <div className="composer-modal-tag-list">
                    <button
                      className={`service-tag service-tag--filter ${!modalTag ? "service-tag--active" : ""}`}
                      onClick={() => setModalTag(null)}
                      type="button"
                    >
                      All
                    </button>
                    {topTags.map(tag => (
                      <button
                        key={tag}
                        className={`service-tag service-tag--filter ${modalTag === tag ? "service-tag--active" : ""}`}
                        onClick={() => setModalTag(prev => prev === tag ? null : tag)}
                        type="button"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Results */}
            <div className="composer-modal-results">
              {filteredModalServices.length === 0 ? (
                <div className="empty-state" style={{ minHeight: "6rem" }}>
                  <p className="empty-state-title">No matching services</p>
                  <p className="empty-state-copy">Try changing the search or filters.</p>
                </div>
              ) : (
                <div className="composer-modal-list">
                  {filteredModalServices.map(service => {
                    const isSelected = selectedSources.some(s => s.url === service.url);
                    return (
                      <div key={service.id} className="composer-modal-item">
                        <div className="composer-modal-item-info">
                          <div className="composer-modal-item-title-row">
                            <strong>{service.name}</strong>
                            <span className="service-price">{service.price}</span>
                          </div>
                          <p className="panel-copy" style={{ fontSize: "0.8rem", margin: 0 }}>
                            {service.description}
                          </p>
                          <div className="composer-modal-item-meta">
                            <span className={`status-pill status-pill--${service.source === "dexter" ? "success" : "ready"}`}>
                              {service.source}
                            </span>
                            {service.category && (
                              <span className="status-pill status-pill--submitted">{service.category}</span>
                            )}
                            {service.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="service-tag">{tag}</span>
                            ))}
                          </div>
                        </div>
                        <button
                          className={isSelected ? "secondary-button" : "primary-button"}
                          onClick={() => isSelected ? removeSource(service.url) : addSource(service)}
                          type="button"
                          style={{ flexShrink: 0 }}
                        >
                          {isSelected ? "Remove" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="composer-modal-footer">
              <span className="panel-copy">
                {selectedSources.length} source{selectedSources.length !== 1 ? "s" : ""} selected
                {" "}&middot;{" "}
                {filteredModalServices.length} result{filteredModalServices.length !== 1 ? "s" : ""}
              </span>
              <button
                className="primary-button"
                onClick={() => setModalOpen(false)}
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: AI Prompt */}
      {step === "prompt" && (
        <div className="composer-step-content">
          <div className="timeline-header">
            <h3>Configure AI reasoning</h3>
            <p>
              Write the system prompt that processes the combined data from your
              selected sources. Use a template or write your own.
            </p>
          </div>

          <div className="composer-templates">
            <strong>Quick templates:</strong>
            <div className="starter-list">
              {PROMPT_TEMPLATES.map(t => (
                <button
                  key={t.label}
                  className="starter-chip"
                  onClick={() => setAiPrompt(t.prompt)}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            className="chat-input composer-prompt-input"
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            rows={10}
            placeholder="Enter the system prompt for AI reasoning over your combined data sources..."
          />

          <div className="service-actions">
            <button className="secondary-button" onClick={() => setStep("sources")} type="button">
              Back
            </button>
            <button
              className="primary-button"
              disabled={!canProceedToMetadata}
              onClick={() => setStep("metadata")}
              type="button"
            >
              Next: Set details
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Metadata */}
      {step === "metadata" && (
        <div className="composer-step-content">
          <div className="timeline-header">
            <h3>Endpoint details</h3>
            <p>Name, describe, and price your composite API.</p>
          </div>

          <div className="composer-form-fields">
            <label className="composer-label">
              <span>Name</span>
              <input
                type="text"
                className="composer-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Multi-Source Market Intelligence"
              />
            </label>

            <label className="composer-label">
              <span>Description</span>
              <textarea
                className="composer-input composer-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe what this endpoint does and what value it provides..."
              />
            </label>

            <label className="composer-label">
              <span>Price (USDC)</span>
              <input
                type="text"
                className="composer-input"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="$0.01"
              />
            </label>
          </div>

          <div className="service-actions">
            <button className="secondary-button" onClick={() => setStep("prompt")} type="button">
              Back
            </button>
            <button
              className="primary-button"
              disabled={!canSave}
              onClick={() => setStep("review")}
              type="button"
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Save */}
      {step === "review" && (
        <div className="composer-step-content">
          <div className="timeline-header">
            <h3>Review your composition</h3>
            <p>Verify the configuration before saving.</p>
          </div>

          <div className="composer-review">
            <div className="composer-review-section">
              <strong>Name:</strong> {name}
            </div>
            <div className="composer-review-section">
              <strong>Description:</strong> {description}
            </div>
            <div className="composer-review-section">
              <strong>Price:</strong> {price}
            </div>
            <div className="composer-review-section">
              <strong>Sources ({selectedSources.length}):</strong>
              <ul className="composer-review-list">
                {selectedSources.map(s => (
                  <li key={s.url}>{s.name} ({s.method} {s.url})</li>
                ))}
              </ul>
            </div>
            <div className="composer-review-section">
              <strong>AI Prompt:</strong>
              <pre className="tool-call-code">{aiPrompt.slice(0, 500)}{aiPrompt.length > 500 ? "..." : ""}</pre>
            </div>
          </div>

          <div className="service-actions">
            <button className="secondary-button" onClick={() => setStep("metadata")} type="button">
              Back
            </button>
            <button
              className="primary-button"
              disabled={saving}
              onClick={saveComposition}
              type="button"
            >
              {saving ? "Saving..." : editing ? "Update composition" : "Create composition"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * When the AI generates a draft, enrich source APIs with metadata from the
 * catalog when there is a URL match. Keeps draft-only sources that are not
 * in the catalog (the user can still review and use them).
 */
function mergeSourcesWithAvailable(
  draftSources: CompositionSourceApi[],
  available: MachineEconomyService[],
): CompositionSourceApi[] {
  return draftSources.map(src => {
    const match = available.find(a => {
      try {
        const srcUrl = new URL(src.url, "http://placeholder");
        const aUrl = new URL(a.url, "http://placeholder");
        return srcUrl.pathname === aUrl.pathname;
      } catch {
        return src.url === a.url;
      }
    });
    if (match) {
      return {
        url: match.url,
        method: match.method,
        name: match.name,
        description: match.description,
      };
    }
    return src;
  });
}
