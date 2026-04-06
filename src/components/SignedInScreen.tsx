import { useEvmAddress, useIsSignedIn } from "@coinbase/cdp-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPublicClient, formatEther, http } from "viem";

import { useAppSession } from "@/components/AppSessionContext";
import AgentDashboard, { type PremiumPaymentEvent } from "@/components/AgentDashboard";
import ApiComposer from "@/components/ApiComposer";
import ChatInterface, { type ChatInterfaceMessages } from "@/components/ChatInterface";
import type { CompositionDraft } from "@/lib/composition-types";
import { PRODUCT_NAME } from "@/lib/branding";
import { IconClose, IconMenu } from "@/components/Icons";
import { getNetworkConfig } from "@/lib/networks";
import PriceChart from "@/components/PriceChart";
import ProfilePage from "@/components/ProfilePage";
import ShowcaseGuide from "@/components/ShowcaseGuide";
import Sidebar, { type NavId } from "@/components/Sidebar";
import WalletsPage from "@/components/WalletsPage";
import X402ServicePanel from "@/components/X402ServicePanel";

export default function SignedInScreen() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { user } = useAppSession();
  const pathname = usePathname();
  const router = useRouter();
  const [balance, setBalance] = useState<bigint | undefined>(undefined);
  const [messages, setMessages] = useState<ChatInterfaceMessages>([]);
  const [paymentEvents, setPaymentEvents] = useState<PremiumPaymentEvent[]>([]);
  const [composerDraft, setComposerDraft] = useState<CompositionDraft | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const networkConfig = getNetworkConfig(user.preferredNetwork);
  const client = useMemo(() => createPublicClient({
    chain: networkConfig.viemChain,
    transport: http(),
  }), [networkConfig.viemChain]);

  const formattedBalance = useMemo(() => {
    if (balance === undefined) return undefined;
    const parsed = Number(formatEther(balance));
    return parsed.toFixed(parsed >= 1 ? 4 : 6);
  }, [balance]);

  const getBalance = useCallback(async () => {
    if (!evmAddress) return;
    const currentBalance = await client.getBalance({ address: evmAddress });
    setBalance(currentBalance);
  }, [client, evmAddress]);

  useEffect(() => {
    const refreshBalance = () => { void getBalance(); };
    const timeout = window.setTimeout(refreshBalance, 0);
    const interval = window.setInterval(refreshBalance, 60000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [getBalance]);

  const handlePaymentEvent = useCallback((event: PremiumPaymentEvent) => {
    setPaymentEvents(prev => [event, ...prev].slice(0, 20));
  }, []);

  const activeNav = useMemo<NavId>(() => {
    const normalized = pathname === "/" ? "chat" : pathname.replace(/^\//, "");
    const allowed = new Set<NavId>(["chat", "creator", "services", "wallets", "dashboard", "profile", "help"]);
    return allowed.has(normalized as NavId) ? (normalized as NavId) : "chat";
  }, [pathname]);

  const handleExportAsApi = useCallback((draft: CompositionDraft) => {
    setComposerDraft(draft);
    router.push("/creator");
  }, [router]);

  const handleDraftConsumed = useCallback(() => {
    setComposerDraft(null);
  }, []);

  const handleNavigate = useCallback((id: NavId) => {
    router.push(`/${id}`);
    setMobileMenuOpen(false);
  }, [router]);

  return (
    <div className="app-layout">
      {/* Mobile header */}
      <header className="mobile-header">
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          type="button"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <IconClose /> : <IconMenu />}
        </button>
        <strong className="mobile-header-title">{PRODUCT_NAME}</strong>
        <span className="mobile-header-address">
          {evmAddress ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` : ""}
        </span>
      </header>

      {/* Sidebar overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          onKeyDown={e => e.key === "Escape" && setMobileMenuOpen(false)}
          role="presentation"
        />
      )}

      {/* Sidebar */}
      <div className={`sidebar-container ${mobileMenuOpen ? "sidebar-container--open" : ""}`}>
        <Sidebar
          activeNav={activeNav}
          onNavigate={handleNavigate}
          ethBalance={formattedBalance}
        />
      </div>

      {/* Main content */}
      <main className="app-content">
        {activeNav === "chat" && (
          <ChatInterface
            onMessagesChange={setMessages}
            onExportAsApi={handleExportAsApi}
          />
        )}

        {activeNav === "creator" && (
          <ApiComposer
            draft={composerDraft}
            onDraftConsumed={handleDraftConsumed}
          />
        )}

        {activeNav === "services" && (
          <X402ServicePanel onPaymentEvent={handlePaymentEvent} />
        )}

        {activeNav === "wallets" && (
          <WalletsPage
            evmAddress={evmAddress}
            isSignedIn={!!isSignedIn}
            formattedBalance={formattedBalance}
            onBalanceRefresh={getBalance}
          />
        )}

        {activeNav === "dashboard" && (
          <div className="content-stack">
            <PriceChart />
            <AgentDashboard
              messages={messages}
              paymentEvents={paymentEvents}
              userAddress={evmAddress}
            />
          </div>
        )}

        {activeNav === "profile" && (
          <ProfilePage />
        )}

        {activeNav === "help" && (
          <ShowcaseGuide />
        )}
      </main>
    </div>
  );
}
