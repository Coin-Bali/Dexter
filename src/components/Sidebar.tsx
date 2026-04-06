"use client";

import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";
import Image from "next/image";
import { useEffect, useState } from "react";

import { useAppSession } from "@/components/AppSessionContext";
import { useThemeMode } from "@/components/ThemeProvider";
import {
  IconChat,
  IconCreator,
  IconDashboard,
  IconHelp,
  IconProfile,
  IconServices,
  IconWallet,
} from "@/components/Icons";
import { PRODUCT_NAME } from "@/lib/branding";
import { getNetworkConfig } from "@/lib/networks";

export type NavId = "chat" | "creator" | "services" | "wallets" | "dashboard" | "profile" | "help";

const NAV_ITEMS: { id: NavId; label: string; icon: React.FC<React.SVGProps<SVGSVGElement>>; section: "main" | "secondary" }[] = [
  { id: "chat", label: "Playground", icon: IconChat, section: "main" },
  { id: "creator", label: "Agents", icon: IconCreator, section: "main" },
  { id: "services", label: "x402 Services", icon: IconServices, section: "main" },
  { id: "wallets", label: "Wallets", icon: IconWallet, section: "main" },
  { id: "dashboard", label: "Dashboard", icon: IconDashboard, section: "main" },
  { id: "profile", label: "Profile", icon: IconProfile, section: "secondary" },
  { id: "help", label: "Help", icon: IconHelp, section: "secondary" },
];

interface SidebarProps {
  activeNav: NavId;
  onNavigate: (id: NavId) => void;
  ethBalance?: string;
}

export default function Sidebar({ activeNav, onNavigate, ethBalance }: SidebarProps) {
  const { user, updateUser } = useAppSession();
  const { themeMode, setThemeMode } = useThemeMode();
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const networkConfig = getNetworkConfig(user.preferredNetwork);

  useEffect(() => {
    let active = true;
    const doLoad = async () => {
      try {
        const res = await fetch(
          `/api/wallet/balances?address=${encodeURIComponent(user.walletAddress)}&network=${encodeURIComponent(networkConfig.key)}`,
          { cache: "no-store" },
        );
        if (active && res.ok) {
          const data = await res.json();
          setUsdcBalance(data.usdc ?? "0");
        }
      } catch { /* best-effort */ }
    };
    doLoad();
    const interval = setInterval(doLoad, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [networkConfig.key, user.walletAddress]);

  const mainItems = NAV_ITEMS.filter(n => n.section === "main");
  const secondaryItems = NAV_ITEMS.filter(n => n.section === "secondary");

  const handleThemeChange = async (nextTheme: "system" | "light" | "dark") => {
    setThemeMode(nextTheme);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeMode: nextTheme }),
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
      }
    } catch {
      // best-effort
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Image className="sidebar-logo-image" src="/logo.svg" alt={`${PRODUCT_NAME} logo`} width={40} height={40} />
        <div className="sidebar-brand-text">
          <strong className="sidebar-title">{PRODUCT_NAME}</strong>
          <span className="sidebar-subtitle">CDP Commerce</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <ul className="sidebar-nav-list">
          {mainItems.map(item => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  className={`sidebar-nav-item ${activeNav === item.id ? "sidebar-nav-item--active" : ""}`}
                  onClick={() => onNavigate(item.id)}
                  type="button"
                >
                  <Icon className="sidebar-nav-icon" />
                  <span className="sidebar-nav-label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="sidebar-divider" />

        <ul className="sidebar-nav-list">
          {secondaryItems.map(item => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  className={`sidebar-nav-item ${activeNav === item.id ? "sidebar-nav-item--active" : ""}`}
                  onClick={() => onNavigate(item.id)}
                  type="button"
                >
                  <Icon className="sidebar-nav-icon" />
                  <span className="sidebar-nav-label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-wallet-summary">
          <span className="sidebar-wallet-address">
            {(user.displayName || `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`)}
          </span>
          <div className="sidebar-wallet-balances">
            <span>{ethBalance ?? "..."} ETH</span>
            <span>{usdcBalance ?? "..."} USDC</span>
          </div>
          <span className="sidebar-subtitle">{networkConfig.label}</span>
        </div>
        <div className="theme-toggle-group">
          {(["system", "light", "dark"] as const).map(option => (
            <button
              key={option}
              className={`theme-toggle-button ${themeMode === option ? "theme-toggle-button--active" : ""}`}
              onClick={() => handleThemeChange(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
        <div className="sidebar-auth">
          <AuthButton />
        </div>
      </div>
    </aside>
  );
}
