import { Frame } from "@/components/frame";
import { Mermaid } from "@/components/mermaid";
import { MdxComponents } from "@/components/mdx-components";
import { Check, Danger, Info, Note, Tip, Warning } from "./callouts";
import {
  Accordion,
  Badge,
  Card,
  CodeGroup,
  Columns,
  Steps,
  Tabs,
} from "./mintlify-wrappers";
import type { AnchorHTMLAttributes, ReactNode } from "react";

function CardGroup({
  children,
  cols = 2,
}: {
  children: ReactNode;
  cols?: number;
}) {
  const colMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };
  return (
    <div className={`grid ${colMap[cols] ?? "grid-cols-2"} gap-4 my-6`}>
      {children}
    </div>
  );
}

// Rewrite relative links (e.g. /platform/instances/overview) to absolute docs URLs
function ChangelogAnchor({
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const resolvedHref =
    href && href.startsWith("/") ? `https://unkey.com/docs${href}` : href;
  return (
    <a
      {...props}
      href={resolvedHref}
      aria-label={props["aria-label"] ?? "Link"}
      className="text-left text-white underline hover:text-white/60"
    />
  );
}

// Use the marketing site's Frame with a default size, since it requires the size prop
function ChangelogFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Frame size="md" className={className}>
      {children}
    </Frame>
  );
}

// Mintlify MDX uses <Tab> and <Step> as children of <Tabs> and <Steps>
const Tab = (Tabs as any).Item;
const Step = (Steps as any).Item;

export const changelogMdxComponents = {
  // Base HTML element overrides from the marketing site
  ...MdxComponents,

  // Override the default anchor to rewrite relative paths to absolute docs URLs
  a: ChangelogAnchor,

  Mermaid,
  Frame: ChangelogFrame,

  // Callout variants — built on the marketing site's Alert component
  Note,
  Info,
  Tip,
  Check,
  Warning,
  Danger,

  // Mintlify layout & content components
  Card,
  CardGroup,
  Accordion,
  Tabs,
  Tab,
  Steps,
  Step,
  Badge,
  CodeGroup,
  Columns,
} as Record<string, any>;
