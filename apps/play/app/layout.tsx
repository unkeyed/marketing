import { ConsentManagerDialog, ConsentManagerProvider, CookieBanner } from "@c15t/nextjs";
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
  const bgColor = "#FFFFFF";
  const bgColorDark = "#000000";
  const primaryColor = "#FFFFFF";
  const primaryColorHover = "#FFFFFF";
  const focusRing = `${primaryColor} !important`;
  const focusShadow = `0 0 0 2px ${primaryColor}`;

  const baseTheme = {
    style: {
      "--button-focus-ring-dark": primaryColor,
      "--button-focus-ring": primaryColor,
      "--button-primary-dark": primaryColor,
      "--button-primary": primaryColor,
      "--button-shadow-primary-dark": `var(--button-shadow-dark), inset 0 0 0 1px ${primaryColor}`,
      "--button-shadow-primary-focus-dark": focusShadow,
      "--button-shadow-primary-focus": focusShadow,
      "--button-shadow-primary": `var(--button-shadow), inset 0 0 0 1px ${primaryColor}`,
      "--button-primary-hover-dark": primaryColorHover,
      "--button-primary-hover": primaryColorHover,
      "--button-border-radius": "0.5rem",
    },
  };

  
  return (
    <html lang="en" className={cn("dark", GeistSans.className)}>
      <body className="w-full bg-black text-[#E2E2E2]">
        <ConsentManagerProvider
          options={{
            mode: "c15t",
            backendURL: "/api/c15t",
            react: {
              colorScheme: "dark",
            },
          }}
        >
          <CookieBanner
            theme={{
              "banner.root": {
                style: {
                  ...baseTheme.style,
                },
              },
              "banner.footer.accept-button": {
                style: {
                  "--button-background-color-dark": "#FFFFFF",
                  "--button-primary-dark": "#000000",
                  "--button-primary-hover-dark": "#FFF",
                },
              },
            }}
          />
          <ConsentManagerDialog
            theme={{
              "dialog.root": {
                style: {
                  ...baseTheme.style,
                  "--accordion-focus-ring-dark": focusRing,
                  "--accordion-focus-ring": focusRing,
                  "--accordion-focus-shadow-dark": focusShadow,
                  "--accordion-focus-shadow": focusShadow,
                  "--dialog-background-color-dark": bgColorDark,
                  "--dialog-background-color": bgColor,
                  "--dialog-branding-focus-color-dark": `var(--button-shadow), inset 0 0 0 1px ${primaryColor}`,
                  "--dialog-branding-focus-color": `var(--button-shadow), inset 0 0 0 1px ${primaryColor}`,
                  "--dialog-footer-background-color-dark": bgColorDark,
                  "--switch-background-color-checked-dark": primaryColor,
                  "--switch-background-color-checked": primaryColor,
                  "--switch-background-color-unchecked-dark": bgColorDark,
                  "--switch-background-color-unchecked": bgColor,
                  "--switch-focus-shadow-dark": focusShadow,
                  "--switch-focus-shadow": focusShadow,
                  "--widget-accordion-background-color-dark": bgColorDark,
                  "--widget-accordion-background-color": bgColor,
                },
              },
              "widget.footer.save-button": {
                style: {
                  "--button-background-color-dark":
                    "linear-gradient(to right, rgb(255 255 255 / 0.8) , rgb(255 255 255 / 1))",
                  "--button-primary-dark": "#000000",
                  "--button-primary-hover-dark": "#FFF",
                },
              },
            }}
          />

          {children}
          <Analytics />
          <Toaster duration={7_000} />
        </ConsentManagerProvider>
      </body>
    </html>
  );
}
