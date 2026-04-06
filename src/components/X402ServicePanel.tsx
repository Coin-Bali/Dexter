"use client";

import { useEvmAddress, useX402 } from "@coinbase/cdp-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { PremiumPaymentEvent } from "@/components/AgentDashboard";
import type { MachineEconomyService } from "@/lib/x402-actions";

interface X402ServicePanelProps {
  onPaymentEvent?: (event: PremiumPaymentEvent) => void;
}

type ServicesResponse = {
  network: string;
  bazaarServices: MachineEconomyService[];
  dexterPremiumServices: MachineEconomyService[];
  totalBazaar: number;
};

const PAGE_SIZE = 12;

async function parseServiceResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

function getPurchaseUrl(service: MachineEconomyService) {
  if (typeof window === "undefined") return service.url;
  try {
    const parsed = new URL(service.url, window.location.origin);
    if (parsed.pathname.startsWith("/api/x402/")) return `${parsed.pathname}${parsed.search}`;
    return parsed.toString();
  } catch {
    return service.url;
  }
}

function formatPreview(value: unknown) {
  if (value === undefined) return "(no response body)";
  const serialized = (() => {
    if (typeof value === "string") return value;
    try { return JSON.stringify(value, null, 2) ?? String(value); }
    catch { return String(value); }
  })();
  return serialized.length <= 800 ? serialized : `${serialized.slice(0, 800)}...`;
}

export default function X402ServicePanel({ onPaymentEvent }: X402ServicePanelProps) {
  const { evmAddress } = useEvmAddress();
  const { fetchWithPayment } = useX402();

  const [services, setServices] = useState<ServicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [responsePreview, setResponsePreview] = useState<string | null>(null);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("10");
  const [activeTab, setActiveTab] = useState<"all" | "dexter" | "bazaar">("all");
  const [bazaarPage, setBazaarPage] = useState(0);

  const loadServices = useCallback(async (keyword?: string, maxPrice?: string) => {
    if (!evmAddress) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        payTo: evmAddress,
        limit: "48",
      });
      if (keyword?.trim()) params.set("keyword", keyword.trim());
      if (maxPrice?.trim()) params.set("maxPrice", maxPrice.trim());

      const response = await fetch(`/api/services?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to load services.");
      setServices(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load services.");
    } finally {
      setLoading(false);
    }
  }, [evmAddress]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleSearch = () => {
    setBazaarPage(0);
    loadServices(searchKeyword, maxPriceFilter);
  };

  const allServices = useMemo(() => {
    if (!services) return [];
    if (activeTab === "dexter") return services.dexterPremiumServices;
    if (activeTab === "bazaar") return services.bazaarServices;
    return [...services.dexterPremiumServices, ...services.bazaarServices];
  }, [services, activeTab]);

  const pagedBazaar = useMemo(() => {
    const start = bazaarPage * PAGE_SIZE;
    return allServices.slice(start, start + PAGE_SIZE);
  }, [allServices, bazaarPage]);

  const totalPages = Math.ceil(allServices.length / PAGE_SIZE);

  const buyService = async (service: MachineEconomyService) => {
    if (!evmAddress) {
      setError("Embedded wallet address not ready yet.");
      return;
    }

    setActiveServiceId(service.id);
    setError(null);
    setResponsePreview(null);

    try {
      const response = await fetchWithPayment(getPurchaseUrl(service), {
        method: service.method,
        headers: { "x-agent-bazaar-pay-to": evmAddress },
      });

      const payload = await parseServiceResponse(response);
      const preview = formatPreview(payload);
      setResponsePreview(preview);

      const paymentStatus = response.ok ? "success" : "error";
      onPaymentEvent?.({
        id: `${service.id}-${Date.now()}`,
        title: service.name,
        endpoint: service.url,
        price: service.price,
        status: paymentStatus,
        timestamp: new Date().toISOString(),
        preview,
      });

      fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userWallet: evmAddress,
          serviceName: service.name,
          endpoint: service.url,
          price: service.price,
          status: paymentStatus,
          responsePreview: preview,
        }),
      }).catch(() => {});

      if (!response.ok) throw new Error(payload.error ?? `Failed to call ${service.name}.`);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : `Failed to call ${service.name}.`;
      setError(message);

      onPaymentEvent?.({
        id: `${service.id}-${Date.now()}`,
        title: service.name,
        endpoint: service.url,
        price: service.price,
        status: "error",
        timestamp: new Date().toISOString(),
        preview: message,
      });

      fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userWallet: evmAddress,
          serviceName: service.name,
          endpoint: service.url,
          price: service.price,
          status: "error",
          responsePreview: message,
        }),
      }).catch(() => {});
    } finally {
      setActiveServiceId(null);
    }
  };

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
  };

  return (
    <section className="panel services-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">x402 Services</p>
          <h2 className="panel-title">Discover and Buy x402 Endpoints</h2>
        </div>
        {services && (
          <span className="status-pill status-pill--ready">
            {services.dexterPremiumServices.length + services.bazaarServices.length} services
          </span>
        )}
      </div>

      {/* Search and filters */}
      <div className="services-filters">
        <div className="services-search-row">
          <input
            type="text"
            className="composer-input"
            placeholder="Search services by name, description, or category..."
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
          <select
            className="services-price-select"
            value={maxPriceFilter}
            onChange={e => setMaxPriceFilter(e.target.value)}
          >
            <option value="0.01">Under $0.01</option>
            <option value="0.1">Under $0.10</option>
            <option value="1">Under $1.00</option>
            <option value="5">Under $5.00</option>
            <option value="10">Under $10.00</option>
            <option value="100">All prices</option>
          </select>
          <button className="primary-button" onClick={handleSearch} type="button">
            Search
          </button>
        </div>

        <div className="services-tab-row">
          {(["all", "dexter", "bazaar"] as const).map(tab => (
            <button
              key={tab}
              className={`services-filter-tab ${activeTab === tab ? "services-filter-tab--active" : ""}`}
              onClick={() => { setActiveTab(tab); setBazaarPage(0); }}
              type="button"
            >
              {tab === "all" ? `All (${(services?.dexterPremiumServices.length ?? 0) + (services?.bazaarServices.length ?? 0)})` :
               tab === "dexter" ? `Agent Bazaar (${services?.dexterPremiumServices.length ?? 0})` :
               `Bazaar (${services?.bazaarServices.length ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="empty-state">
          <p className="empty-state-title">Loading service catalog</p>
          <p className="empty-state-copy">Fetching Bazaar metadata and local premium endpoints.</p>
        </div>
      )}

      {error && <div className="inline-error">{error}</div>}

      {responsePreview && (
        <div className="response-preview">
          <div className="timeline-header">
            <h3>Purchase Response</h3>
            <p>Result from the x402-protected endpoint.</p>
          </div>
          <pre>{responsePreview}</pre>
          <button className="secondary-button" onClick={() => setResponsePreview(null)} type="button">
            Dismiss
          </button>
        </div>
      )}

      {services && !loading && (
        <>
          {allServices.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">No services found</p>
              <p className="empty-state-copy">
                Try widening the price filter, clearing the search keyword, or switching to a different tab.
              </p>
            </div>
          ) : (
            <>
              <div className="services-results-grid">
                {pagedBazaar.map(service => (
                  <article
                    key={service.id}
                    className={`service-result-card ${service.source === "dexter" ? "service-result-card--featured" : ""}`}
                  >
                    <div className="service-result-header">
                      <div className="service-result-title-row">
                        <strong>{service.name}</strong>
                        <span className="service-price">{service.price}</span>
                      </div>
                      <div className="service-result-badges">
                        <span className={`status-pill status-pill--${service.source === "dexter" ? "success" : "ready"}`}>
                          {service.source}
                        </span>
                        {service.category && (
                          <span className="status-pill status-pill--submitted">{service.category}</span>
                        )}
                      </div>
                    </div>

                    <p className="panel-copy">{service.description}</p>

                    <div className="service-result-url">
                      {service.url.length > 60 ? `${service.url.slice(0, 60)}...` : service.url}
                    </div>

                    {service.tags.length > 0 && (
                      <div className="service-result-tags">
                        {service.tags.slice(0, 5).map(tag => (
                          <span key={tag} className="service-tag">{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="service-actions">
                      <button
                        className="primary-button"
                        disabled={activeServiceId === service.id || !evmAddress}
                        onClick={() => buyService(service)}
                        type="button"
                      >
                        {activeServiceId === service.id ? "Paying..." : "Buy"}
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => copyUrl(service.url)}
                        type="button"
                      >
                        Copy URL
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="services-pagination">
                  <button
                    className="secondary-button"
                    disabled={bazaarPage === 0}
                    onClick={() => setBazaarPage(p => p - 1)}
                    type="button"
                  >
                    Previous
                  </button>
                  <span className="services-pagination-info">
                    Page {bazaarPage + 1} of {totalPages}
                  </span>
                  <button
                    className="secondary-button"
                    disabled={bazaarPage >= totalPages - 1}
                    onClick={() => setBazaarPage(p => p + 1)}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          <p className="panel-copy" style={{ fontSize: "0.78rem", marginTop: "0.5rem" }}>
            Network: <strong>{services.network}</strong>
          </p>
        </>
      )}
    </section>
  );
}
