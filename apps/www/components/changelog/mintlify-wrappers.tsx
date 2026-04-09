"use client";

// Re-export Mintlify components as client components so they can be safely
// imported into a server module and passed to MDXRemote as component references.
export {
  Accordion,
  Badge,
  Card,
  Check,
  CodeGroup,
  Columns,
  Danger,
  Info,
  Note,
  Steps,
  Tabs,
  Tip,
  Warning,
} from "@mintlify/components";
