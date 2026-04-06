"use client";

import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";
import { useEffect, useState } from "react";

import { useAppSession } from "@/components/AppSessionContext";
import { IconCheck, IconCopy, IconExternalLink } from "@/components/Icons";
import { useThemeMode } from "@/components/ThemeProvider";
import { listSupportedNetworks } from "@/lib/networks";

type ProfileStats = {
  wallet: string;
  exists: boolean;
  createdAt?: string;
  lastSeenAt?: string;
  conversations: number;
  messages: number;
  payments: number;
  compositions: number;
  apiCalls: number;
};

export default function ProfilePage() {
  const { user, updateUser, refreshSession } = useAppSession();
  const { setThemeMode } = useThemeMode();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [roleDescription, setRoleDescription] = useState(user.roleDescription ?? "");
  const [preferredNetwork, setPreferredNetwork] = useState(user.preferredNetwork);
  const [themePreference, setThemePreference] = useState(user.themeMode);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user.walletAddress) return;
      try {
        const res = await fetch("/api/profile/stats", { cache: "no-store" });
        if (active && res.ok) setStats(await res.json());
      } catch { /* best-effort */ }
    })();
    return () => { active = false; };
  }, [user.walletAddress]);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(user.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          roleDescription: roleDescription.trim(),
          preferredNetwork,
          themeMode: themePreference,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update profile.");
      }

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
      setThemeMode(payload.user.themeMode);
      setSaveMessage("Profile updated.");
      await refreshSession();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content-stack">
      <section className="wallet-section">
        <div className="profile-header">
          <div className="profile-avatar">
            {(displayName || user.walletAddress).slice(0, 2).toUpperCase()}
          </div>
          <div className="profile-info">
            <h2 className="profile-name">
              {displayName || `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`}
            </h2>
            <span className="status-pill status-pill--ready">
              {preferredNetwork === "base" ? "Base" : "Base Sepolia"}
            </span>
          </div>
        </div>

        <div className="wallet-address-full">
          <span>{user.walletAddress}</span>
          <button onClick={copyAddress} type="button" aria-label="Copy address">
            {copied ? <IconCheck /> : <IconCopy />}
          </button>
          <a
            href={`${preferredNetwork === "base" ? "https://basescan.org" : "https://sepolia.basescan.org"}/address/${user.walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconExternalLink />
          </a>
        </div>

        <div className="composer-form-fields">
          <label className="composer-label">
            <span>Display name</span>
            <input
              className="composer-input"
              type="text"
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
              placeholder="Display name"
            />
          </label>

          <label className="composer-label">
            <span>Role or use case</span>
            <textarea
              className="composer-input composer-textarea"
              value={roleDescription}
              onChange={event => setRoleDescription(event.target.value)}
              placeholder="Describe what you are building"
            />
          </label>

          <label className="composer-label">
            <span>Preferred network</span>
            <select
              className="composer-input"
              value={preferredNetwork}
              onChange={event => setPreferredNetwork(event.target.value as typeof preferredNetwork)}
            >
              {listSupportedNetworks().map(network => (
                <option key={network.preferenceValue} value={network.preferenceValue}>
                  {network.label}
                </option>
              ))}
            </select>
          </label>

          <label className="composer-label">
            <span>Theme preference</span>
            <select
              className="composer-input"
              value={themePreference}
              onChange={event => setThemePreference(event.target.value as typeof themePreference)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>

        <div className="service-actions">
          <button className="primary-button" disabled={saving} onClick={handleSave} type="button">
            {saving ? "Saving..." : "Save profile"}
          </button>
          {saveMessage && <span className="panel-copy">{saveMessage}</span>}
        </div>

        <div className="profile-stats-grid">
          <div className="profile-stat-card">
            <span className="profile-stat-value">{stats?.conversations ?? "..."}</span>
            <span className="profile-stat-label">Conversations</span>
          </div>
          <div className="profile-stat-card">
            <span className="profile-stat-value">{stats?.messages ?? "..."}</span>
            <span className="profile-stat-label">Messages Sent</span>
          </div>
          <div className="profile-stat-card">
            <span className="profile-stat-value">{stats?.payments ?? "..."}</span>
            <span className="profile-stat-label">x402 Payments</span>
          </div>
          <div className="profile-stat-card">
            <span className="profile-stat-value">{stats?.compositions ?? "..."}</span>
            <span className="profile-stat-label">APIs Created</span>
          </div>
          <div className="profile-stat-card">
            <span className="profile-stat-value">{stats?.apiCalls ?? "..."}</span>
            <span className="profile-stat-label">API Calls Received</span>
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: "0.5rem" }}>Account Details</h3>
          <div className="profile-detail-row">
            <span className="profile-detail-label">Network</span>
            <span className="profile-detail-value">{preferredNetwork === "base" ? "Base (8453)" : "Base Sepolia (84532)"}</span>
          </div>
          <div className="profile-detail-row">
            <span className="profile-detail-label">First seen</span>
            <span className="profile-detail-value">
              {stats?.createdAt ? new Date(stats.createdAt).toLocaleDateString() : "N/A"}
            </span>
          </div>
          <div className="profile-detail-row">
            <span className="profile-detail-label">Last active</span>
            <span className="profile-detail-value">
              {stats?.lastSeenAt ? new Date(stats.lastSeenAt).toLocaleDateString() : "N/A"}
            </span>
          </div>
          <div className="profile-detail-row">
            <span className="profile-detail-label">Block explorer</span>
            <span className="profile-detail-value">
              <a
                href={`${preferredNetwork === "base" ? "https://basescan.org" : "https://sepolia.basescan.org"}/address/${user.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Basescan
              </a>
            </span>
          </div>
        </div>

        <div>
          <AuthButton />
        </div>
      </section>
    </div>
  );
}
