export const domainCategories = [
  {
    name: "Official",
    domains: ["tools.ietf.org", "datatracker.ietf.org", "rfc-editor.org", "w3.org", "iso.org"],
    description: "Official standards and specifications sources",
  },
  {
    name: "Community",
    domains: [
      "stackoverflow.com",
      "github.com",
      "wikipedia.org",
      "news.ycombinator.com",
      "stackexchange.com",
    ],
    description: "Community-driven platforms and forums",
  },
  {
    name: "Neutral",
    domains: ["owasp.org", "developer.mozilla.org"],
    description: "Educational and vendor-neutral resources",
  },
  {
    name: "Google",
    domains: [], // Empty domains array to search without domain restrictions
    description: "General search results without domain restrictions",
  },
] as const;

export type DomainCategory = (typeof domainCategories)[number]["name"];
