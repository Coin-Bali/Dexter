"use client";

import { useState } from "react";

import type { SessionUser } from "@/components/AppSessionContext";
import { PRODUCT_NAME } from "@/lib/branding";
import { listSupportedNetworks } from "@/lib/networks";

type ThemePreference = "system" | "light" | "dark";

export default function RegistrationFlow({
  user,
  onCompleted,
}: {
  user: SessionUser;
  onCompleted: (nextUser: SessionUser) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [roleDescription, setRoleDescription] = useState(user.roleDescription ?? "");
  const [preferredNetwork, setPreferredNetwork] = useState(user.preferredNetwork);
  const [themeMode, setThemeMode] = useState<ThemePreference>(user.themeMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          roleDescription: roleDescription.trim(),
          preferredNetwork,
          themeMode,
          registrationCompleted: true,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save registration.");
      }

      await onCompleted(payload.user);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to save registration.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="card sign-in-card">
      <h1 className="sr-only">Registration</h1>
      <p className="eyebrow">Welcome</p>
      <p className="card-title">Set up your {PRODUCT_NAME} profile</p>
      <p>Choose how the app should present your wallet, network, and theme preferences.</p>

      <div className="composer-form-fields" style={{ width: "100%" }}>
        <label className="composer-label">
          <span>Display name</span>
          <input
            className="composer-input"
            type="text"
            value={displayName}
            onChange={event => setDisplayName(event.target.value)}
            placeholder="How should we refer to you?"
          />
        </label>

        <label className="composer-label">
          <span>What are you building?</span>
          <textarea
            className="composer-input composer-textarea"
            value={roleDescription}
            onChange={event => setRoleDescription(event.target.value)}
            placeholder="Optional short role or use-case description"
          />
        </label>

        <label className="composer-label">
          <span>Preferred network</span>
          <select
            className="composer-input"
            value={preferredNetwork}
            onChange={event => setPreferredNetwork(event.target.value as SessionUser["preferredNetwork"])}
          >
            {listSupportedNetworks().map(network => (
              <option key={network.preferenceValue} value={network.preferenceValue}>
                {network.label}
              </option>
            ))}
          </select>
        </label>

        <label className="composer-label">
          <span>Theme</span>
          <select
            className="composer-input"
            value={themeMode}
            onChange={event => setThemeMode(event.target.value as ThemePreference)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>

      {error && <div className="inline-error">{error}</div>}

      <button
        className="primary-button"
        disabled={submitting || displayName.trim().length < 2}
        onClick={handleSubmit}
        type="button"
      >
        {submitting ? "Saving..." : "Continue to the app"}
      </button>
    </main>
  );
}
