import { RainbowDarkButton } from "@/components/button";
import { ChangelogGridItem } from "@/components/changelog/changelog-grid-item";
import { changelogMdxComponents } from "@/components/changelog/changelog-mdx-components";
import { SideList } from "@/components/changelog/side-list";
import { CTA } from "@/components/cta";
import { MDX } from "@/components/mdx-content";
import { ChangelogLight } from "@/components/svg/changelog";
import { allChangelogs } from "content-collections";
import { formatDate } from "date-fns";
import { ArrowRight } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";

const GITHUB_REPO = "unkeyed/unkey";
const CHANGELOG_PATH = "docs/product/changelog";

function parseFrontmatter(source: string): {
  title: string;
  description?: string;
  tags: string[];
} {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { title: "", tags: ["product"] };
  }

  const fm = match[1];

  const get = (key: string) => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m ? m[1].replace(/^["']|["']$/g, "").trim() : undefined;
  };

  const tags = ["product"];

  return { title: get("title") ?? "", description: get("description"), tags };
}

async function fetchProductChangelogs() {
  try {
    const headers: HeadersInit = { Accept: "application/vnd.github.v3+json" };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${CHANGELOG_PATH}`,
      { headers, next: { revalidate: 86400 } },
    );
    if (!res.ok) {
      return [];
    }

    const entries = (await res.json()) as Array<{
      type: string;
      name: string;
      download_url: string;
    }>;

    const mdxFiles = entries.filter((f) => f.type === "file" && f.name.endsWith(".mdx"));

    const results = await Promise.all(
      mdxFiles.map(async (file) => {
        const raw = await fetch(file.download_url, {
          next: { revalidate: 86400 },
        });
        if (!raw.ok) {
          console.error(`Failed to fetch changelog file ${file.name}: ${raw.status}`);
          return null;
        }
        const source = (await raw.text()).replace(/^noindex:\s*.+$/m, "");
        const date = file.name.slice(0, -4); // YYYY-MM-DD from filename
        const { title, description, tags } = parseFrontmatter(source);
        return { slug: date, date, title, description, tags, source };
      }),
    );

    return results.filter((entry) => entry !== null);
  } catch (err) {
    console.error("Failed to fetch product changelogs:", err);
    return [];
  }
}

export default async function Changelogs() {
  const productEntries = await fetchProductChangelogs();

  const collectionEntries = allChangelogs.map((e) => ({
    ...e,
    _kind: "collection" as const,
  }));
  const githubEntries = productEntries.map((e) => ({
    ...e,
    _kind: "github" as const,
  }));

  const changelogs = [...collectionEntries, ...githubEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <>
      <div className="container mt-48 text-white/60">
        <div>
          <div className="relative -z-100 max-w-[1000px] mx-auto">
            <ChangelogLight />
          </div>
        </div>
        <div>
          <div className="flex flex-row text-center">
            <div className="mx-auto flex-flex-col ">
              <a href="https://x.com/unkeydev" target="_blank" rel="noreferrer">
                <RainbowDarkButton label="Follow us on X" IconRight={ArrowRight} />
              </a>
              <h2 className="blog-heading-gradient text-6xl font-medium mt-12">Changelog</h2>
              <p className="mt-6 font-normal leading-7 text-balance">
                We are constantly improving our product, fixing bugs and introducing features.{" "}
                <br className="hidden lg:inline" />
                Here you can find the latest updates and changes to Unkey.
              </p>
            </div>
          </div>

          <div className="flex flex-row mt-[5.5rem] gap-20 mb-20 w-full mx-auto">
            <div className="relative hidden w-72 lg:block">
              <div className="top-20 sticky">
                <SideList
                  list={changelogs.map((c) => ({
                    href: `/changelog#${c.slug}`,
                    label: formatDate(c.date, "MMMM dd, yyyy"),
                  }))}
                />
              </div>
            </div>
            <div className="flex flex-col w-full sm:overflow-hidden">
              {changelogs.map((entry) => (
                <ChangelogGridItem key={entry.slug} changelog={entry}>
                  {entry._kind === "collection" ? (
                    <MDX code={entry.mdx} />
                  ) : (
                    <MDXRemote
                      source={entry.source}
                      options={{ parseFrontmatter: true }}
                      components={changelogMdxComponents}
                    />
                  )}
                </ChangelogGridItem>
              ))}
            </div>
          </div>
        </div>
      </div>
      <CTA />
    </>
  );
}

export const metadata = {
  title: "Changelog | Unkey",
  description: "Stay up-to-date with the latest updates and changes to Unkey",
  openGraph: {
    title: "Changelog | Unkey",
    description: "Stay up-to-date with the latest updates and changes to Unkey",
    url: "https://unkey.com/changelog",
    siteName: "unkey.com",
    images: [
      {
        url: "https://unkey.com/og",
        width: 1200,
        height: 675,
      },
    ],
  },
  twitter: {
    title: "Changelog | Unkey",
    card: "summary_large_image",
  },
  icons: {
    shortcut: "/images/landing/unkey.png",
  },
};
