import type React from "react";
import { Alert } from "../ui/alert/alert";
import { Separator } from "../ui/separator";
import { CodeBlock } from "./codeblock";

import type { JSX } from "react";

// Type for MDX component props that includes common MDX-specific properties
type MDXComponentProps<T extends keyof JSX.IntrinsicElements> =
  React.ComponentPropsWithoutRef<T> & {
    ordered?: boolean;
    inline?: boolean;
    node?: any;
  };

// Helper function to filter out non-DOM attributes with proper typing
const filterDOMProps = <T extends keyof JSX.IntrinsicElements>(props: MDXComponentProps<T>) => {
  const { ordered, inline, node, ...domProps } = props;
  return domProps;
};

export const TemplateComponents = {
  Callout: Alert,
  img: (props: MDXComponentProps<"img">) => (
    <img
      {...filterDOMProps(props)}
      alt={typeof props?.alt === "string" ? props.alt : ""}
      loading="lazy"
      decoding="async"
      className="object-cover object-center p-0 rounded-3xl"
    />
  ),
  th: (props: MDXComponentProps<"th">) => (
    <th {...filterDOMProps(props)} className="text-base font-semibold text-white" />
  ),
  tr: (props: MDXComponentProps<"tr">) => (
    <tr {...filterDOMProps(props)} className="border-b-[.75px] border-white/10 " />
  ),
  td: (props: MDXComponentProps<"td">) => (
    <td {...filterDOMProps(props)} className="py-2 text-base font-normal text-white/70" />
  ),
  a: (props: MDXComponentProps<"a">) => (
    <a {...filterDOMProps(props)} className="text-white underline hover:text-white/60 ellipsis" />
  ),
  ol: (props: MDXComponentProps<"ol">) => (
    <ol {...filterDOMProps(props)} className="pl-4 text-white list-decimal marker:text-white" />
  ),
  ul: (props: MDXComponentProps<"ul">) => (
    <ul
      {...filterDOMProps(props)}
      className="pl-4 text-white list-disc sm:pt-4 marker:text-white "
    />
  ),
  li: (props: MDXComponentProps<"li">) => (
    <li {...filterDOMProps(props)} className="pl-6 mb-3 mr-2 leading-8 text-white/60" />
  ),
  h1: (props: MDXComponentProps<"h1">) => (
    <h1
      {...filterDOMProps(props)}
      className="text-[32px] font-medium leading-8 blog-heading-gradient "
    />
  ),
  h2: (props: MDXComponentProps<"h2">) => (
    <h2
      {...filterDOMProps(props)}
      className="text-[32px] font-medium leading-8 blog-heading-gradient "
    />
  ),
  h3: (props: MDXComponentProps<"h3">) => (
    <h3
      {...filterDOMProps(props)}
      className="text-xl font-medium leading-8 blog-heading-gradient "
    />
  ),
  h4: (props: MDXComponentProps<"h4">) => (
    <h4
      {...filterDOMProps(props)}
      className="text-lg font-medium leading-8 blog-heading-gradient "
    />
  ),
  p: (props: MDXComponentProps<"p">) => (
    <p
      {...filterDOMProps(props)}
      className="font-normal leading-8 text-left sm:text-sm md:text-lg text-white/60 "
    />
  ),
  hr: (_props: MDXComponentProps<"hr">) => <Separator orientation="horizontal" />,
  code: (props: MDXComponentProps<"code">) => (
    <code
      {...filterDOMProps(props)}
      className="px-2 py-1 font-medium text-gray-600 border border-gray-200 rounded-md bg-gray-50 "
    />
  ),
  pre: (props: MDXComponentProps<"pre">) => <CodeBlock {...props} />,
};
