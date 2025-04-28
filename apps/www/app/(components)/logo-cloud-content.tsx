import Image from "next/image";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import Link from "next/link";

const logos = [
  {
    name: "Fireworks",
    url: "/images/logo-cloud/fireworks-ai.svg",
    href: "https://fireworks.ai",
  },
  {
    name: "cal.com",
    url: "/images/logo-cloud/calcom.svg",
    href: "https://cal.com",
  },
  {
    name: "Mintlify",
    url: "/images/logo-cloud/mintlify.svg",
    href: "https://mintlify.com",
  },
];

export function DesktopLogoCloud() {
  return (
    <div className="hidden md:flex w-full flex-col items-center">
      <span
        className={cn(
          "font-mono text-sm md:text-md text-white/50 text-center opacity-0 animate-fade-in-up [animation-delay:1s]",
        )}
      >
        Powering
      </span>

      <div className="flex w-full flex-col items-center justify-center px-4 md:px-8">
        <div className="mt-10 grid grid-cols-3 gap-x-6">
          {logos.map((logo, idx) => (
            <div
              key={String(idx)}
              className={cn(
                "relative w-[229px] aspect-[229/36]",
                "opacity-0 animate-fade-in-up [animation-delay:var(--animation-delay)]",
              )}
              style={
                {
                  "--animation-delay": `calc(1.1s + .12s * ${idx})`,
                } as CSSProperties
              }
            >
              <Link href={logo.href} target="_blank">
                <Image src={logo.url} alt={logo.name} fill />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const MobileLogoCloud = () => {
  return (
    <div className="md:hidden w-full flex flex-col items-center">
      <span
        className={cn("font-mono text-sm md:text-md text-white/50 text-center")}
      >
        Powering
      </span>

      <div className="w-full px-4 md:px-8">
        <div
          className="group relative mt-6 flex gap-6 overflow-hidden p-2"
          style={{
            maskImage:
              "linear-gradient(to left, transparent 0%, black 20%, black 80%, transparent 95%)",
          }}
        >
          {[0, 1, 2].map((groupIndex) => (
            <div
              key={`logo-group-${groupIndex}`}
              className="flex shrink-0 animate-logo-cloud flex-row justify-around gap-6"
            >
              {logos.map((logo, logoIndex) => (
                <div
                  key={`${groupIndex}-${logo.name}`}
                  className="relative w-[229px] aspect-[229/36]"
                >
                  <Link href={logo.href} target="_blank">
                    <Image src={logo.url} alt={logo.name} fill />
                  </Link>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
