import type { Metadata } from "next";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
};

/**
 * Root layout for the Next.js app
 *
 * @param props - { object } - The props for the RootLayout component
 * @param props.children - { React.ReactNode } - The children to wrap
 * @returns The wrapped children
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="root">{children}</div>
      </body>
    </html>
  );
}
