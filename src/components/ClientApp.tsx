"use client";

import { useEvmAddress, useIsInitialized, useIsSignedIn } from "@coinbase/cdp-hooks";
import { useCallback, useEffect, useState } from "react";

import { AppSessionProvider, type SessionUser } from "@/components/AppSessionContext";
import AuthenticateWalletScreen from "@/components/AuthenticateWalletScreen";
import Loading from "@/components/Loading";
import RegistrationFlow from "@/components/RegistrationFlow";
import SignedInScreen from "@/components/SignedInScreen";
import SignInScreen from "@/components/SignInScreen";
import { useThemeMode } from "@/components/ThemeProvider";

/**
 * A component that displays the client app.
 */
export default function ClientApp() {
  const { isInitialized } = useIsInitialized();
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { setThemeMode } = useThemeMode();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionState, setSessionState] = useState<"idle" | "loading" | "authenticated" | "unauthenticated">("unauthenticated");

  const refreshSession = useCallback(async () => {
    if (!isSignedIn) {
      setSessionUser(null);
      setSessionState("unauthenticated");
      return;
    }

    setSessionState("loading");

    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) {
        setSessionUser(null);
        setSessionState("unauthenticated");
        return;
      }

      const payload = await response.json();
      setSessionUser(payload.user);
      setThemeMode(payload.user.themeMode);
      setSessionState("authenticated");
    } catch {
      setSessionUser(null);
      setSessionState("unauthenticated");
    }
  }, [isSignedIn, setThemeMode]);

  useEffect(() => {
    if (isInitialized && isSignedIn) {
      queueMicrotask(() => {
        void refreshSession();
      });
    }
  }, [evmAddress, isInitialized, isSignedIn, refreshSession]);

  const effectiveSessionUser = isSignedIn ? sessionUser : null;
  const effectiveSessionState = isSignedIn ? sessionState : "unauthenticated";

  return (
    <div className="app flex-col-container flex-grow">
      {!isInitialized && <Loading />}
      {isInitialized && (
        <>
          {!isSignedIn && <SignInScreen />}
          {isSignedIn && effectiveSessionState === "loading" && !effectiveSessionUser && (
            <Loading variant="shell" />
          )}
          {isSignedIn && effectiveSessionState === "unauthenticated" && (
            <AuthenticateWalletScreen onAuthenticated={refreshSession} />
          )}
          {isSignedIn && effectiveSessionState === "authenticated" && effectiveSessionUser && !effectiveSessionUser.registrationCompleted && (
            <RegistrationFlow
              user={effectiveSessionUser}
              onCompleted={async nextUser => {
                setSessionUser(nextUser);
                setSessionState("authenticated");
              }}
            />
          )}
          {isSignedIn && effectiveSessionState === "authenticated" && effectiveSessionUser && effectiveSessionUser.registrationCompleted && (
            <AppSessionProvider
              value={{
                user: effectiveSessionUser,
                refreshSession,
                updateUser: setSessionUser,
              }}
            >
              <SignedInScreen />
            </AppSessionProvider>
          )}
          {isSignedIn && effectiveSessionState === "loading" && effectiveSessionUser && effectiveSessionUser.registrationCompleted && (
            <AppSessionProvider
              value={{
                user: effectiveSessionUser,
                refreshSession,
                updateUser: setSessionUser,
              }}
            >
              <SignedInScreen />
            </AppSessionProvider>
          )}
        </>
      )}
    </div>
  );
}
