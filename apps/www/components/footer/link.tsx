import { shouldUseNextLink } from "@/lib/site-navigation";
import Link from "next/link";

type FooterLinkProps = {
  href: string;
  title: string;
  external?: boolean;
};

export function FooterLink({ href, title, external }: FooterLinkProps) {
  const className = "text-sm font-normal transition hover:text-white/40 text-white/70";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {title}
      </a>
    );
  }

  if (shouldUseNextLink(href)) {
    return (
      <Link href={href} className={className}>
        {title}
      </Link>
    );
  }

  return (
    <a href={href} className={className}>
      {title}
    </a>
  );
}
