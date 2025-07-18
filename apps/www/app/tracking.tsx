"use client";

import { useConsentManager } from "@c15t/nextjs";
import { Analytics } from "@vercel/analytics/next";

export function Tracking() {
  const { hasConsentFor } = useConsentManager();

  return hasConsentFor("measurement") ? <Analytics /> : null;
}
