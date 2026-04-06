import { notFound } from "next/navigation";

import AppRoot from "@/components/AppRoot";

const ALLOWED_SECTIONS = new Set([
  "chat",
  "creator",
  "services",
  "wallets",
  "dashboard",
  "profile",
  "help",
]);

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (!ALLOWED_SECTIONS.has(section)) {
    notFound();
  }

  return <AppRoot />;
}
