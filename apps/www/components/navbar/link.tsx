"use client";
import { shouldUseNextLink } from "@/lib/site-navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

type Props = { href: string; label: string; external?: boolean };

export const DesktopNavLink: React.FC<Props> = ({ href, label, external }) => {
  const segment = useSelectedLayoutSegment();
  const className = cn("text-white/50 hover:text-white/90 duration-200 text-sm tracking-[0.07px]", {
    "text-white": href.startsWith(`/${segment}`),
  });

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }

  if (shouldUseNextLink(href)) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
};

export function MobileNavLink({
  href,
  label,
  external,
  onClick,
}: { href: string; label: string; external?: boolean; onClick: () => void }) {
  const segment = useSelectedLayoutSegment();
  const className = cn(
    "block w-full py-3 text-left text-lg font-medium tracking-[0.07px] text-white/50 duration-200 hover:text-white",
    {
      "text-white": href.startsWith(`/${segment}`),
    },
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
      >
        {label}
      </a>
    );
  }

  if (shouldUseNextLink(href)) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {label}
      </Link>
    );
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {label}
    </a>
  );
}
