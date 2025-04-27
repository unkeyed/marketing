import { BlogHero } from "@/components/blog/blog-hero";
import { ClientBlogGrid } from "@/components/blog/client-blog-grid";
import { CTA } from "@/components/cta";
import { TopLeftShiningLight, TopRightShiningLight } from "@/components/svg/background-shiny";
import { MeteorLinesAngular } from "@/components/ui/meteorLines";
import { authors } from "@/content/blog/authors";
import { type Post, allPosts } from "content-collections";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata = {
  title: "Blog | Unkey",
  description: "Latest blog posts and news from the Unkey team.",
  openGraph: {
    title: "Blog | Unkey",
    description: "Latest blog posts and news from the Unkey team.",
    url: "https://unkey.com/blog",
    siteName: "unkey.com",
    images: [
      {
        url: "https://unkey.com/og.png",
        width: 1200,
        height: 675,
      },
    ],
  },
  twitter: {
    title: "Blog | Unkey",
    card: "summary_large_image",
  },
  icons: {
    shortcut: "/images/landing/unkey.png",
  },
};

export default async function Blog() {
  const posts = allPosts.sort((a: Post, b: Post) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  const featuredPost = posts[0];
  const blogGridPosts = posts.slice(1, posts.length);

  return (
    <>
      <div className="container w-full pt-48 mx-auto overflow-hidden scroll-smooth">
        <div>
          <TopLeftShiningLight />
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
        <div>
          <TopRightShiningLight />
        </div>

        {featuredPost ? (
          <div className="w-full px-0 mx-0 rounded-3xl">
            <Link href={`${featuredPost.url}`} key={featuredPost.url}>
              <BlogHero
                tags={featuredPost.tags}
                imageUrl={featuredPost.image ?? "/images/blog-images/defaultBlog.png"}
                title={featuredPost.title}
                subTitle={featuredPost.description}
                author={authors[featuredPost.author]}
                publishDate={featuredPost.date}
              />
            </Link>
          </div>
        ) : null}

        <ClientBlogGrid posts={blogGridPosts} />
        <CTA />
      </div>
    </>
  );
}
