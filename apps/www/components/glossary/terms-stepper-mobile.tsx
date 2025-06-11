"use client";

import type { Glossary } from "@/.content-collections/generated";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function TermsStepperMobile({
  className,
  terms,
}: {
  className?: string;
  terms: Array<Pick<Glossary, "slug" | "title">>;
}) {
  const params = useParams();
  const slug = params.slug as string;
  const sortedTerms = terms.sort((a, b) => a.title.localeCompare(b.title));
  const slugIndex = sortedTerms.findIndex((term) => term.slug === slug);
  const startIndex = slugIndex !== -1 ? slugIndex : 0;
  const currentTerm = sortedTerms[startIndex];
  const previousTerm =
    sortedTerms[(startIndex - 1 + sortedTerms.length) % sortedTerms.length];
  const nextTerm = sortedTerms[(startIndex + 1) % sortedTerms.length];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col h-full justify-between content-between">
        <div className="grid grid-cols-3 gap-2 pb-4 px-2">
          <Link
            href={`/glossary/${previousTerm.slug}`}
            className="flex w-full flex-row items-center gap-2 rounded-lg p-3 text-sm transition-colors text-white/60 hover:text-white hover:bg-white/5 border border-white/10"
          >
            <ChevronLeftIcon className="size-4 shrink-0" />
            <span className="truncate">{previousTerm.title}</span>
          </Link>

          <div className="text-center py-3 px-2">
            <p className="font-medium text-sm text-white truncate">
              {currentTerm.title}
            </p>
          </div>

          <Link
            href={`/glossary/${nextTerm.slug}`}
            className="flex w-full flex-row items-center gap-2 rounded-lg p-3 text-sm transition-colors text-white/60 hover:text-white hover:bg-white/5 border border-white/10 justify-end"
          >
            <span className="truncate">{nextTerm.title}</span>
            <ChevronRightIcon className="size-4 shrink-0" />
          </Link>
        </div>
      </div>
    </div>
  );
}
