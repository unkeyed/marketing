"use client";

import type { Post } from "content-collections";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BlogGrid } from "./blogs-grid";

type ClientBlogGridProps = {
  posts: Post[];
};

export function ClientBlogGrid({ posts }: ClientBlogGridProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Extract search parameters
  const tag = searchParams.get("tag") || undefined;
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;

  // Create a searchParams object for the BlogGrid component
  const params = {
    tag,
    page: page || 1,
  };

  // Function to update URL without page refresh
  const updateSearchParams = (newParams: { tag?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (newParams.tag) {
      params.set("tag", newParams.tag);
    } else {
      params.delete("tag");
    }

    if (newParams.page && newParams.page > 1) {
      params.set("page", newParams.page.toString());
    } else {
      params.delete("page");
    }

    const newUrl = `${pathname}?${params.toString()}`;
    router.push(newUrl, { scroll: false });
  };

  return <BlogGrid posts={posts} searchParams={params} updateSearchParams={updateSearchParams} />;
}
