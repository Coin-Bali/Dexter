"use client";

import { createContext, useContext } from "react";

import type { ThemeMode } from "@/generated/prisma";

export type SessionUser = {
  id: string;
  walletAddress: string;
  displayName: string | null;
  roleDescription: string | null;
  preferredNetwork: "base_sepolia" | "base";
  themeMode: ThemeMode;
  registrationCompleted: boolean;
  createdAt: string | Date;
  lastSeenAt: string | Date;
};

type AppSessionContextValue = {
  user: SessionUser;
  refreshSession: () => Promise<void>;
  updateUser: (user: SessionUser) => void;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

export function AppSessionProvider({
  value,
  children,
}: {
  value: AppSessionContextValue;
  children: React.ReactNode;
}) {
  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) {
    throw new Error("useAppSession must be used within AppSessionProvider");
  }

  return context;
}
