"use client";

import ClientApp from "@/components/ClientApp";
import Providers from "@/components/Providers";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function AppRoot() {
  return (
    <ThemeProvider>
      <Providers>
        <ClientApp />
      </Providers>
    </ThemeProvider>
  );
}
