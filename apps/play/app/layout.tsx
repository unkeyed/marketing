import { ConsentManagerProvider } from "@c15t/nextjs";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";
import { ConsentBanner } from "./consent-banner";
import { Tracking } from "./tracking";

export const metadata: Metadata = {
  title: "Unkey Playground",
  description: "Playground for Unkey API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", GeistSans.className)}>
      <body className="w-full bg-black text-[#E2E2E2]">
        <ConsentManagerProvider
          options={{
            ...(process.env.NEXT_PUBLIC_C15T_MODE
              ? { mode: "c15t", backendURL: "/api/c15t" }
              : { mode: "offline" }),
            react: {
              colorScheme: "dark",
            },
          }}
        >
          <ConsentBanner />
          {children}
          <Tracking />
          <Toaster duration={7_000} />
        </ConsentManagerProvider>
      </body>
    </html>
  );
}
