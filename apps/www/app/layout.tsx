import { Footer } from "@/components/footer/footer";
import { Navigation } from "@/components/navbar/navigation";
import { env } from "@/lib/env";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";
import { ConsentManagerDialog, ConsentManagerProvider, CookieBanner } from "@c15t/nextjs";
import { Analytics } from "@vercel/analytics/next";

const parsedEnv = env();

export const metadata: Metadata = {
  metadataBase: new URL(parsedEnv.NEXT_PUBLIC_BASE_URL),
  title: "Unkey",
  description: "Build better APIs faster",
  openGraph: {
    title: "Unkey",
    description: "Build better APIs faster",
    url: parsedEnv.NEXT_PUBLIC_BASE_URL,
    siteName: "unkey.com",
    images: [
      {
        url: `${parsedEnv.NEXT_PUBLIC_BASE_URL}/og.png`,
        width: 1200,
        height: 675,
      },
    ],
  },
  twitter: {
    title: "Unkey",
    card: "summary_large_image",
  },
  icons: {
    shortcut: "/unkey.png",
  },
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
    <html
      lang="en"
      className={`[color-scheme:dark] scroll-smooth ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen overflow-x-hidden antialiased bg-black text-pretty">
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

          <div className="relative overflow-x-clip">
            <Navigation />
            {children}
            <Analytics />
            {process.env.NODE_ENV !== "production" ? (
              <div className="fixed bottom-0 right-0 flex items-center justify-center w-6 h-6 p-3 m-8 font-mono text-xs text-black bg-white rounded-lg pointer-events-none ">
                <div className="block sm:hidden md:hidden lg:hidden xl:hidden 2xl:hidden">al</div>
                <div className="hidden sm:block md:hidden lg:hidden xl:hidden 2xl:hidden">sm</div>
                <div className="hidden sm:hidden md:block lg:hidden xl:hidden 2xl:hidden">md</div>
                <div className="hidden sm:hidden md:hidden lg:block xl:hidden 2xl:hidden">lg</div>
                <div className="hidden sm:hidden md:hidden lg:hidden xl:block 2xl:hidden">xl</div>
                <div className="hidden sm:hidden md:hidden lg:hidden xl:hidden 2xl:block">2xl</div>
              </div>
            ) : null}
          </div>
          <Footer />
        </ConsentManagerProvider>
      </body>
    </html>
  );
}
