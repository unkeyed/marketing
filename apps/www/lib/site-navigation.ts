const preservedNextLinkRoutes = ["/templates", "/careers", "/docs", "/oss-friends"] as const;

const normalizeHref = (href: string) => href.split(/[?#]/, 1)[0] ?? href;

export function shouldUseNextLink(href: string): boolean {
  if (!href.startsWith("/")) {
    return false;
  }

  const normalizedHref = normalizeHref(href);

  return preservedNextLinkRoutes.some(
    (route) => normalizedHref === route || normalizedHref.startsWith(`${route}/`),
  );
}
