"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

type ThemeContextValue = {
  themeMode: ThemePreference;
  resolvedTheme: "light" | "dark";
  setThemeMode: (mode: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "agent-bazaar-theme-mode";

function getSystemTheme() {
  if (typeof window === "undefined") {
    return "light" as const;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [themeMode, setThemeModeState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") {
      return "system";
    }

    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    return saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "system";
  });
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => getSystemTheme());
  const resolvedTheme = themeMode === "system" ? systemTheme : themeMode;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    window.localStorage.setItem(STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (themeMode !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setSystemTheme(getSystemTheme());
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode: setThemeModeState,
    }),
    [resolvedTheme, themeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within ThemeProvider");
  }

  return context;
}
