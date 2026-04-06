"use client";

import { CDPReactProvider } from "@coinbase/cdp-react";

import { theme } from "@/components/theme";
import { PRODUCT_NAME } from "@/lib/branding";

interface ProvidersProps {
  children: React.ReactNode;
}

const CDP_CONFIG = {
  projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID ?? "",
  appName: PRODUCT_NAME,
  appLogoUrl: "/logo.svg",
  disableAnalytics: true,
};

/**
 * Providers component that wraps the application in all requisite providers
 *
 * @param props - { object } - The props for the Providers component
 * @param props.children - { React.ReactNode } - The children to wrap
 * @returns The wrapped children
 */
export default function Providers({ children }: ProvidersProps) {
  return (
    <CDPReactProvider config={CDP_CONFIG} theme={theme}>
      {children}
    </CDPReactProvider>
  );
}
