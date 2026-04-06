"use client";

import { useEffect, useState } from "react";

import { useAppSession } from "@/components/AppSessionContext";
import { IconCopy, IconCheck, IconExternalLink } from "@/components/Icons";
import OnRampOffRamp from "@/components/OnRampOffRamp";
import Transaction from "@/components/Transaction";
import { getNetworkConfig, listSupportedNetworks } from "@/lib/networks";

interface WalletsPageProps {
  evmAddress: string | null;
  isSignedIn: boolean;
  formattedBalance?: string;
  onBalanceRefresh: () => void;
}

type WalletBalances = {
  eth: string;
  usdc: string;
  network?: string;
};

type AgentProfile = {
  configured: boolean;
  address?: string;
  network?: string;
  balanceEth?: string;
  missingEnv?: string[];
};

type PaymentRecord = {
  id: string;
  type: "payment" | "transfer";
  title: string;
  status: string;
  createdAt: string;
  detail: string;
  amountLabel: string | null;
};

type AssetRecord = {
  symbol: string;
  name: string;
  address: string | null;
  balanceRaw: string;
  balanceFormatted: string;
  decimals: number;
  isNative: boolean;
};

export default function WalletsPage({ evmAddress, isSignedIn, formattedBalance, onBalanceRefresh }: WalletsPageProps) {
  const { user, updateUser, refreshSession } = useAppSession();
  const [userBalances, setUserBalances] = useState<WalletBalances | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [agentBalances, setAgentBalances] = useState<WalletBalances | null>(null);
  const [activity, setActivity] = useState<PaymentRecord[]>([]);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [sendToAgent, setSendToAgent] = useState(false);
  const [networkPreference, setNetworkPreference] = useState(user.preferredNetwork);
  const networkConfig = getNetworkConfig(networkPreference);
  const [userAssets, setUserAssets] = useState<AssetRecord[]>([]);
  const [agentAssets, setAgentAssets] = useState<AssetRecord[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [agentTransferTo, setAgentTransferTo] = useState("");
  const [agentTransferAmount, setAgentTransferAmount] = useState("1");
  const [agentTransferToken, setAgentTransferToken] = useState("USDC");
  const [agentTransferStatus, setAgentTransferStatus] = useState<string | null>(null);

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  useEffect(() => {
    let active = true;
    const doLoad = async () => {
      if (!evmAddress) return;
      try {
        const [balRes, agentRes, activityRes, userAssetsRes] = await Promise.all([
          fetch(`/api/wallet/balances?address=${encodeURIComponent(evmAddress)}&network=${encodeURIComponent(networkConfig.key)}`, { cache: "no-store" }),
          fetch("/api/agent/profile", { cache: "no-store" }),
          fetch(`/api/wallet/activity?page=${activityPage}&pageSize=10`, { cache: "no-store" }),
          fetch(`/api/wallet/assets?address=${encodeURIComponent(evmAddress)}&network=${encodeURIComponent(networkConfig.key)}&search=${encodeURIComponent(assetSearch)}&page=1&pageSize=20`, { cache: "no-store" }),
        ]);
        if (!active) return;
        if (balRes.ok) setUserBalances(await balRes.json());
        if (userAssetsRes.ok) {
          const assetsPayload = await userAssetsRes.json();
          if (active) setUserAssets(assetsPayload.assets ?? []);
        }
        if (agentRes.ok) {
          const agentData = await agentRes.json();
          setAgentProfile(agentData);
          if (agentData.address) {
            const [agentBalRes, agentAssetsRes] = await Promise.all([
              fetch(`/api/wallet/balances?address=${encodeURIComponent(agentData.address)}&network=${encodeURIComponent(networkConfig.key)}`, { cache: "no-store" }),
              fetch(`/api/wallet/assets?address=${encodeURIComponent(agentData.address)}&network=${encodeURIComponent(networkConfig.key)}&page=1&pageSize=20`, { cache: "no-store" }),
            ]);
            if (active && agentBalRes.ok) setAgentBalances(await agentBalRes.json());
            if (active && agentAssetsRes.ok) {
              const agentAssetsPayload = await agentAssetsRes.json();
              setAgentAssets(agentAssetsPayload.assets ?? []);
            }
          }
        }
        if (activityRes.ok) {
          const activityData = await activityRes.json();
          if (active) {
            setActivity(activityData.activity ?? []);
            setActivityTotal(activityData.total ?? 0);
          }
        }
      } catch { /* best-effort */ }
    };
    doLoad();
    const interval = setInterval(doLoad, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [activityPage, assetSearch, evmAddress, networkConfig.key]);

  const handleNetworkChange = async (nextPreference: typeof user.preferredNetwork) => {
    setNetworkPreference(nextPreference);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredNetwork: nextPreference }),
      });
      const payload = await response.json();
      if (response.ok) {
        updateUser({
          id: payload.user.id,
          walletAddress: payload.user.walletAddress,
          displayName: payload.user.displayName,
          roleDescription: payload.user.roleDescription,
          preferredNetwork: payload.user.preferredNetwork,
          themeMode: payload.user.themeMode,
          registrationCompleted: payload.user.registrationCompleted,
          createdAt: payload.user.createdAt,
          lastSeenAt: payload.user.lastSeenAt,
        });
        await refreshSession();
      }
    } catch {
      // best-effort
    }
  };

  const handleAgentTransfer = async () => {
    setAgentTransferStatus("Submitting transfer...");
    try {
      const response = await fetch("/api/agent/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: agentTransferTo,
          amount: agentTransferAmount,
          token: agentTransferToken,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to transfer from agent wallet.");
      }

      setAgentTransferStatus(`Transfer submitted: ${payload.transactionHash}`);
    } catch (error) {
      setAgentTransferStatus(error instanceof Error ? error.message : "Failed to transfer from agent wallet.");
    }
  };

  return (
    <div className="content-stack">
      {/* User Wallet */}
      <section className="wallet-section">
        <div className="wallet-section-header">
          <div>
            <p className="eyebrow">Your Wallet</p>
            <h2 className="panel-title">Embedded Wallet</h2>
          </div>
          <div className="wallet-section-controls">
            <select
              className="composer-input"
              value={networkPreference}
              onChange={event => handleNetworkChange(event.target.value as typeof user.preferredNetwork)}
            >
              {listSupportedNetworks().map(network => (
                <option key={network.preferenceValue} value={network.preferenceValue}>
                  {network.label}
                </option>
              ))}
            </select>
            <span className="status-pill status-pill--ready">{networkConfig.label}</span>
          </div>
        </div>

        {evmAddress && (
          <div className="wallet-address-full">
            <span>{evmAddress}</span>
            <button onClick={() => copyAddress(evmAddress)} type="button" aria-label="Copy address">
              {copiedAddress === evmAddress ? <IconCheck /> : <IconCopy />}
            </button>
            <a href={`${networkConfig.explorerBaseUrl}/address/${evmAddress}`} target="_blank" rel="noopener noreferrer">
              <IconExternalLink />
            </a>
          </div>
        )}

        <div className="wallet-balances-row">
          <div className="wallet-balance-item">
            <span className="wallet-balance-token">ETH</span>
            <span className="wallet-balance-value">{userBalances?.eth ?? formattedBalance ?? "..."}</span>
          </div>
          <div className="wallet-balance-item">
            <span className="wallet-balance-token">USDC</span>
            <span className="wallet-balance-value">{userBalances?.usdc ?? "..."}</span>
          </div>
        </div>

        <div className="wallet-actions-row">
          <OnRampOffRamp evmAddress={evmAddress} />
        </div>

        {isSignedIn && evmAddress && (
          <Transaction
            balance={formattedBalance}
            onSuccess={onBalanceRefresh}
            recipientAddress={sendToAgent && agentProfile?.address ? agentProfile.address : undefined}
            recipientLabel={sendToAgent ? "Agent Wallet" : undefined}
            networkPreference={networkPreference}
          />
        )}

        {agentProfile?.configured && agentProfile.address && (
          <button
            className={sendToAgent ? "primary-button" : "secondary-button"}
            onClick={() => setSendToAgent(!sendToAgent)}
            type="button"
          >
            {sendToAgent ? "Cancel fund agent" : "Fund Agent Wallet (ETH or USDC)"}
          </button>
        )}

        <div className="wallet-section-subgroup">
          <div className="wallet-section-header">
            <h3>Tracked assets</h3>
            <input
              className="composer-input wallet-asset-search"
              type="text"
              value={assetSearch}
              onChange={event => setAssetSearch(event.target.value)}
              placeholder="Search assets"
            />
          </div>
          <div className="wallet-assets-list">
            {userAssets.map(asset => (
              <div key={`${asset.symbol}-${asset.address ?? "native"}`} className="wallet-asset-row">
                <div>
                  <strong>{asset.symbol}</strong>
                  <p className="panel-copy">{asset.name}</p>
                </div>
                <span className="wallet-asset-balance">{asset.balanceFormatted}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agent Wallet */}
      <section className="wallet-section">
        <div className="wallet-section-header">
          <div>
            <p className="eyebrow">Agent Wallet</p>
            <h2 className="panel-title">Server-side CDP Wallet</h2>
          </div>
          {agentProfile?.configured ? (
            <span className="status-pill status-pill--ready">Active</span>
          ) : (
            <span className="status-pill status-pill--error">Not Configured</span>
          )}
        </div>

        {agentProfile?.configured && agentProfile.address ? (
          <>
            <div className="wallet-address-full">
              <span>{agentProfile.address}</span>
              <button onClick={() => copyAddress(agentProfile.address!)} type="button" aria-label="Copy agent address">
                {copiedAddress === agentProfile.address ? <IconCheck /> : <IconCopy />}
              </button>
              <a href={`${networkConfig.explorerBaseUrl}/address/${agentProfile.address}`} target="_blank" rel="noopener noreferrer">
                <IconExternalLink />
              </a>
            </div>

            <div className="wallet-balances-row">
              <div className="wallet-balance-item">
                <span className="wallet-balance-token">ETH</span>
                <span className="wallet-balance-value">{agentBalances?.eth ?? agentProfile.balanceEth ?? "..."}</span>
              </div>
              <div className="wallet-balance-item">
                <span className="wallet-balance-token">USDC</span>
                <span className="wallet-balance-value">{agentBalances?.usdc ?? "..."}</span>
              </div>
            </div>

            <p className="panel-copy">
              This wallet is controlled server-side by AgentKit. It can autonomously discover and purchase x402 services, execute swaps, and perform onchain actions.
            </p>

            <div className="wallet-section-subgroup">
              <h3>Tracked assets</h3>
              <div className="wallet-assets-list">
                {agentAssets.map(asset => (
                  <div key={`${asset.symbol}-${asset.address ?? "native"}`} className="wallet-asset-row">
                    <div>
                      <strong>{asset.symbol}</strong>
                      <p className="panel-copy">{asset.name}</p>
                    </div>
                    <span className="wallet-asset-balance">{asset.balanceFormatted}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="wallet-section-subgroup">
              <h3>Withdraw from agent wallet</h3>
              <div className="send-form-row">
                <input
                  className="composer-input"
                  type="text"
                  value={agentTransferTo}
                  onChange={event => setAgentTransferTo(event.target.value)}
                  placeholder="Recipient address"
                />
                <input
                  className="composer-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={agentTransferAmount}
                  onChange={event => setAgentTransferAmount(event.target.value)}
                  placeholder="Amount"
                />
                <select
                  className="composer-input"
                  value={agentTransferToken}
                  onChange={event => setAgentTransferToken(event.target.value)}
                >
                  {networkConfig.tokens
                    .filter(token => token.symbol === "ETH" || token.symbol === "USDC")
                    .map(token => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.symbol}
                      </option>
                    ))}
                </select>
              </div>
              <div className="service-actions">
                <button className="secondary-button" onClick={handleAgentTransfer} type="button">
                  Withdraw from agent
                </button>
                {agentTransferStatus && <span className="panel-copy">{agentTransferStatus}</span>}
              </div>
            </div>
          </>
        ) : (
          <div className="info-banner">
            The agent wallet is not configured.
            {agentProfile?.missingEnv?.length
              ? ` Missing: ${agentProfile.missingEnv.join(", ")}.`
              : " Required environment variables are missing."}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      {activity.length > 0 && (
        <section className="wallet-section">
          <div>
            <p className="eyebrow">Activity</p>
            <h2 className="panel-title">Wallet Activity</h2>
          </div>

          <div className="timeline-list">
            {activity.map(p => (
              <article key={p.id} className="timeline-item">
                <div className="timeline-item-header">
                  <strong>{p.title}</strong>
                  <span className={`status-pill status-pill--${p.status}`}>{p.amountLabel ?? p.type}</span>
                </div>
                <p className="panel-copy">{p.detail}</p>
                <span className="timeline-timestamp">
                  {new Date(p.createdAt).toLocaleString()}
                </span>
              </article>
            ))}
          </div>
          {activityTotal > 10 && (
            <div className="services-pagination">
              <button
                className="secondary-button"
                disabled={activityPage === 1}
                onClick={() => setActivityPage(page => Math.max(page - 1, 1))}
                type="button"
              >
                Previous
              </button>
              <span className="services-pagination-info">
                Page {activityPage} of {Math.max(Math.ceil(activityTotal / 10), 1)}
              </span>
              <button
                className="secondary-button"
                disabled={activityPage >= Math.ceil(activityTotal / 10)}
                onClick={() => setActivityPage(page => page + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
