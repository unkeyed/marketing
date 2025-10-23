"use client";
import { CopyButton } from "@/components/copy-button";
import { BlogCodeDownload } from "@/components/svg/blog-code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/code-tabs";
import { cn } from "@/lib/utils";
import {
  type ClassAttributes,
  type HTMLAttributes,
  type JSX,
  type ReactElement,
  useState,
} from "react";
import React from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import darkTheme from "./darkTheme";

const CN_BLOG_CODE_BLOCK =
  "flex flex-col bg-gradient-to-t from-[rgba(255,255,255,0.1)] to-[rgba(255,255,255,0.07)] rounded-[20px] border-[.5px] border-[rgba(255,255,255,0.1)] not-prose text-[0.8125rem]";
// Helper function to extract language from className
const extractLanguageFromClassName = (className: string | undefined): string => {
  if (!className) {
    return "text";
  }

  const classes = className.split(/\s+/);
  const languageClass = classes.find((cls) => cls.startsWith("language-"));

  if (!languageClass) {
    return "text";
  }

  return languageClass.replace(/^language-/, "") || "text";
};

export type CodeBlockProps = {
  className: string;
  children: ReactElement<ChildNode>;
};
export function BlogCodeBlock({
  className,
  children,
}: JSX.IntrinsicAttributes & ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement>) {
  const blocks = React.Children.map(children, (child: any) => child?.props?.children?.props).filter(
    Boolean,
  );

  const buttonLabels: string[] = blocks.map((b: any) => extractLanguageFromClassName(b?.className));
  const [copyData, setCopyData] = useState(blocks?.[0]?.children || "");

  function handleDownload() {
    const element = document.createElement("a");
    const file = new Blob([copyData], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "code.txt";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }
  function handlelOnChange(value: string) {
    const idx = buttonLabels.indexOf(value);
    if (idx >= 0 && blocks[idx]?.children) {
      setCopyData(blocks[idx].children);
    }
  }
  return (
    <div className={cn(CN_BLOG_CODE_BLOCK, className)}>
      <Tabs
        defaultValue={buttonLabels[0]}
        onValueChange={(value) => handlelOnChange(value)}
        className="flex flex-col"
      >
        <div className="flex flex-row border-b-[.5px] border-white/10 p-2">
          <TabsList className="flex flex-row justify-start w-full gap-4 align-bottom h-fit">
            {React.Children.map(buttonLabels, (label: string) => {
              return (
                <TabsTrigger key={label} value={label} className="capitalize text-white/30">
                  {label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <div className="flex flex-row gap-4 pt-0 pr-4">
            <CopyButton value={copyData} />
            <button type="button" className="p-0 m-0 bg-transparent" onClick={handleDownload}>
              <BlogCodeDownload />
            </button>
          </div>
        </div>
        {blocks.map((block: any, index: number) => {
          if (!block || !block.className) {
            return null;
          }
          return (
            <TabsContent value={buttonLabels[index]} key={buttonLabels[index]} className="pr-12">
              <SyntaxHighlighter
                language={extractLanguageFromClassName(block.className)}
                style={darkTheme}
                showLineNumbers={true}
                wrapLongLines={true}
                wrapLines={true}
              >
                {block.children || ""}
              </SyntaxHighlighter>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
export function BlogCodeBlockSingle({ className, children }: any) {
  const block = children?.props;
  const [copyData, _setCopyData] = useState(block?.children || "");

  function handleDownload() {
    const element = document.createElement("a");
    const file = new Blob([copyData], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "code.txt";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }

  const isSingleLine = (block?.children?.match?.(/\n/g) || []).length < 2;

  return (
    <div className={cn(CN_BLOG_CODE_BLOCK, className, `${isSingleLine ? "p-4" : "pl-4 pb-4"}`)}>
      <div className="flex flex-row justify-end gap-4 mt-2 mr-4 border-white/10">
        {!isSingleLine && (
          <>
            <CopyButton value={copyData} />
            <button
              type="button"
              aria-label="Download code"
              className="p-0 m-0 align-top bg-transparent"
              onClick={handleDownload}
            >
              <BlogCodeDownload />
            </button>
          </>
        )}
      </div>
      <div className={`flex ${isSingleLine ? "items-center justify-between" : ""}`}>
        <SyntaxHighlighter
          language={extractLanguageFromClassName(block?.className)}
          style={darkTheme}
          showLineNumbers={true}
          highlighter={"hljs"}
        >
          {block?.children?.trim?.() || ""}
        </SyntaxHighlighter>

        {isSingleLine && (
          <div className={cn("flex gap-4 border-white/10")}>
            <CopyButton value={copyData} />
            <button
              type="button"
              aria-label="Download code"
              className="p-0 m-0 align-top bg-transparent"
              onClick={handleDownload}
            >
              <BlogCodeDownload />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
