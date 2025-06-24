import { CTA } from "@/components/cta";
import { Frame } from "@/components/frame";

import { MDX } from "@/components/mdx-content";
import { TopLeftShiningLight, TopRightShiningLight } from "@/components/svg/background-shiny";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MeteorLinesAngular } from "@/components/ui/meteorLines";
import { cn } from "@/lib/utils";
import { allGlossaries } from "content-collections";
import { Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FAQ } from "./faq";
import Takeaways from "./takeaways";

export const generateStaticParams = async () =>
  allGlossaries.map((term) => ({
    slug: term.slug,
  }));

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const term = allGlossaries.find((term) => term.slug === params.slug);
  if (!term) {
    notFound();
  }
  return {
    title: `${term.title} | Unkey Glossary`,
    description: term.description,
    openGraph: {
      title: `${term.title} | Unkey Glossary`,
      description: term.description,
      url: `https://unkey.com/glossary/${term.slug}`,
      siteName: "unkey.com",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${term.title} | Unkey Glossary`,
      description: term.description,
      site: "@unkeydev",
      creator: "@unkeydev",
    },
    icons: {
      shortcut: "/images/landing/unkey.png",
    },
  };
}

const GlossaryTermWrapper = async ({
  params,
}: {
  params: { slug: string };
}) => {
  const term = allGlossaries.find((term) => term.slug === params.slug);
  if (!term) {
    notFound();
  }

  const relatedTerms: {
    slug: string;
    term: string;
    tldr: string;
  }[] = [];
  return (
    <>
      <div className="container pt-48 mx-auto px-4 sm:px-6 lg:px-8 sm:overflow-hidden md:overflow-visible scroll-smooth ">
        <div>
          <TopLeftShiningLight className="hidden h-full -z-40 sm:block" />
        </div>
        <div className="w-full h-full overflow-hidden -z-20">
          <MeteorLinesAngular
            number={1}
            xPos={0}
            speed={10}
            delay={5}
            className="overflow-hidden"
          />
          <MeteorLinesAngular
            number={1}
            xPos={0}
            speed={10}
            delay={0}
            className="overflow-hidden"
          />
          <MeteorLinesAngular
            number={1}
            xPos={100}
            speed={10}
            delay={7}
            className="overflow-hidden md:hidden"
          />
          <MeteorLinesAngular
            number={1}
            xPos={100}
            speed={10}
            delay={2}
            className="overflow-hidden md:hidden"
          />
          <MeteorLinesAngular
            number={1}
            xPos={200}
            speed={10}
            delay={7}
            className="hidden overflow-hidden md:block"
          />
          <MeteorLinesAngular
            number={1}
            xPos={200}
            speed={10}
            delay={2}
            className="hidden overflow-hidden md:block"
          />
          <MeteorLinesAngular
            number={1}
            xPos={400}
            speed={10}
            delay={5}
            className="hidden overflow-hidden lg:block"
          />
          <MeteorLinesAngular
            number={1}
            xPos={400}
            speed={10}
            delay={0}
            className="hidden overflow-hidden lg:block"
          />
        </div>
        <div className="overflow-hidden -z-40">
          <TopRightShiningLight />
        </div>
        <div className="flex flex-row w-full gap-8 lg:gap-12">
          <div className="flex flex-col w-full lg:w-3/4">
            <div className="prose sm:prose-sm md:prose-md sm:mx-6">
              <div className="flex items-center gap-5 p-0 m-0 mb-8 text-xl font-medium leading-8">
                <Link href="/glossary">
                  <span className="text-transparent bg-gradient-to-r bg-clip-text from-white to-white/60 ">
                    Glossary
                  </span>
                </Link>
                <span className="text-white/40">/</span>
                <span className="text-transparent capitalize bg-gradient-to-r bg-clip-text from-white to-white/60">
                  {term.term}
                </span>
              </div>

              <h1 className="not-prose blog-heading-gradient text-left text-4xl font-medium leading-[56px] tracking-tight  sm:text-5xl sm:leading-[72px]">
                {term.h1}
              </h1>
            </div>
            <div className="sm:mx-6 mt-8">
              <Takeaways takeaways={term.takeaways} term={term.term} />
            </div>
            <div className="mt-12 prose-sm lg:pr-24 md:prose-md text-white/60 sm:mx-6 prose-strong:text-white/90 prose-code:text-white/80 prose-code:bg-white/10 prose-code:px-2 prose-code:py-1 prose-code:border-white/20 prose-code:rounded-md prose-pre:p-0 prose-pre:m-0 prose-pre:leading-6">
              <MDX code={term.mdx} />
            </div>
            <div className="sm:mx-6 mt-12">
              <FAQ
                items={term.faq}
                title={`Questions & Answers about ${term.term}`}
                description={`We answer common questions about ${term.term}.`}
                epigraph="FAQ"
              />
            </div>
          </div>

          <div className="items-start hidden h-full gap-4 pt-8 space-y-4 prose lg:sticky top-24 lg:w-1/4 not-prose lg:mt-12 lg:flex lg:flex-col min-w-0 max-w-full overflow-hidden">
            {term.tableOfContents?.length !== 0 ? (
              <div className="flex flex-col gap-4 not-prose lg:gap-2">
                <p className="text-sm prose text-nowrap text-white/50">Contents</p>
                <ul className="relative flex flex-col gap-1 overflow-hidden min-w-0">
                  {term.tableOfContents.map((heading) => {
                    if (!heading) {
                      return null;
                    }
                    return (
                      <li key={`#${heading.slug}`}>
                        <Link
                          data-level={heading.level}
                          className={cn("block min-w-0", {
                            "text-md font-medium mt-4 text-transparent bg-clip-text bg-gradient-to-r from-white  to-white/70 truncate":
                              heading.level === 1 || heading.level === 2,
                            "text-sm ml-4 leading-8 text-transparent bg-clip-text bg-gradient-to-r from-white/60  to-white/50 truncate":
                              heading.level === 3 || heading.level === 4,
                          })}
                          href={`#${heading.slug}`}
                        >
                          <span className="truncate block">{heading.text}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-col mt-4">
              <p className="pt-10 text-md text-white/50">Related Terms</p>
              <div>
                {relatedTerms.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {relatedTerms.map((relatedTerm) => (
                      <Link
                        href={`/glossary/${relatedTerm.slug}`}
                        key={relatedTerm.slug}
                        className="block"
                      >
                        <Card className="w-full bg-white/5 shadow-[0_0_10px_rgba(255,255,255,0.1)] rounded-xl overflow-hidden relative border-white/20">
                          <CardHeader>
                            <Frame size="sm">
                              <div className="p-4 rounded-md space-y-2">
                                <h3 className="text-sm font-semibold flex items-center text-white">
                                  <Zap className="mr-2 h-5 w-5" /> TL;DR
                                </h3>
                                <p className="text-sm text-white/80">{relatedTerm.tldr}</p>
                              </div>
                            </Frame>
                          </CardHeader>
                          <CardContent>
                            <h4 className="text-md font-semibold text-white mb-2">
                              {relatedTerm.term}
                            </h4>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/50">No related terms found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <CTA />
      </div>
    </>
  );
};

export default GlossaryTermWrapper;
