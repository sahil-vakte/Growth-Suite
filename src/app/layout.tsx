import "./globals.css";
import type { Metadata } from "next";
import { env } from "@/lib/env";

// Each HTML response needs fresh script nonces, including login and error pages.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: env.appName,
  description: "Website, lead generation and marketing automation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
