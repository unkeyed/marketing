import { Analytics } from "@vercel/analytics/next";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

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
        {children}
        <Analytics />
        <Toaster duration={7_000} />
      </body>
    </html>
  );
}
