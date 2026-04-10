import { cacheLife, cacheTag } from "next/cache";
import { allChangelogs } from "content-collections";

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
      { headers },
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
        try {
          const raw = await fetch(file.download_url);
          if (!raw.ok) {
            console.error(`Failed to fetch changelog file ${file.name}: ${raw.status}`);
            return null;
          }
          const source = (await raw.text()).replace(/^noindex:\s*.+$/m, "");
          const date = file.name.slice(0, -4); // YYYY-MM-DD from filename
          const { title, description, tags } = parseFrontmatter(source);
          return { slug: date, date, title, description, tags, source };
        } catch (err) {
          console.error(`Failed to process changelog file ${file.name}:`, err);
          return null;
        }
      }),
    );

    return results.filter((entry) => entry !== null);
  } catch (err) {
    console.error("Failed to fetch product changelogs:", err);
    return [];
  }
}

export async function getAllChangelogs() {
  "use cache";
  cacheLife("days");
  cacheTag("changelogs");

  const productEntries = await fetchProductChangelogs();

  const collectionEntries = allChangelogs.map((e) => ({
    ...e,
    _kind: "collection" as const,
  }));
  const githubEntries = productEntries.map((e) => ({
    ...e,
    _kind: "github" as const,
  }));

  return [...collectionEntries, ...githubEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}
