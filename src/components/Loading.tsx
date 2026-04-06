"use client";

import Image from "next/image";

/**
 * App loading screen
 */
export default function Loading({
  variant = "boot",
}: {
  variant?: "boot" | "shell";
}) {
  if (variant === "shell") {
    return (
      <div className="app-layout app-layout--loading">
        <aside className="sidebar sidebar--loading">
          <div className="sidebar-brand">
            <Image className="sidebar-logo-image" src="/logo.svg" alt="Agent Bazaar logo" width={40} height={40} />
            <div className="sidebar-brand-text">
              <strong className="sidebar-title">Agent Bazaar</strong>
              <span className="sidebar-subtitle">CDP Commerce</span>
            </div>
          </div>
          <div className="sidebar-nav sidebar-nav--loading">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="sidebar-loading-item loading-placeholder" />
            ))}
          </div>
        </aside>
        <main className="app-content">
          <section className="panel loading-shell-panel">
            <div className="loading-shell-header">
              <span className="loading-shell-title loading-placeholder" />
              <span className="loading-shell-badge loading-placeholder" />
            </div>
            <div className="loading-shell-card loading-placeholder" />
            <div className="loading-shell-card loading-placeholder" />
            <div className="loading-shell-card loading-placeholder" />
          </section>
        </main>
      </div>
    );
  }

  return (
    <main className="panel sign-in-card">
      <h1 className="sr-only">Loading</h1>
      <div className="loading-spinner" aria-hidden="true" />
      <p className="panel-copy">Initializing embedded wallet and session...</p>
    </main>
  );
}
