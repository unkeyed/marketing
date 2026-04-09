import { Mermaid } from "@/components/mermaid";
import { useMDXComponent } from "@content-collections/mdx/react";
import { MdxComponents } from "./mdx-components";
export { MdxComponents } from "./mdx-components";

interface MDXProps {
  code: string;
}

export function MDX({ code }: MDXProps) {
  const Component = useMDXComponent(code);
  return (
    <Component
      components={
        {
          Mermaid,
          ...MdxComponents,
        } as any
      }
    />
  );
}
