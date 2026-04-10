import { RainbowDarkButton } from "@/components/button";
import { ChangelogGridItem } from "@/components/changelog/changelog-grid-item";
import { changelogMdxComponents } from "@/components/changelog/changelog-mdx-components";
import { SideList } from "@/components/changelog/side-list";
import { CTA } from "@/components/cta";
import { MDX } from "@/components/mdx-content";
import { ChangelogLight } from "@/components/svg/changelog";
import { formatDate } from "date-fns";
import { ArrowRight } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Suspense } from "react";
import { getAllChangelogs } from "./data";

async function ChangelogFeed() {
  const changelogs = await getAllChangelogs();

  return (
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
  );
}

export default function Changelogs() {
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

          <Suspense>
            <ChangelogFeed />
          </Suspense>
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
