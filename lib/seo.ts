export const siteConfig = {
  name: "ContextKings",
  shortName: "ContextKings",
  title: "ContextKings | AI Research Workflow Builder",
  description:
    "ContextKings turns plain-English research requests into executable CrustData workflows for company research, prospecting, recruiting, and signal monitoring.",
  ogDescription:
    "Plan and run CrustData-powered research workflows for prospecting, recruiting, company research, and market signals.",
  keywords: [
    "ContextKings",
    "CrustData",
    "AI research workflow builder",
    "sales intelligence",
    "company research",
    "prospect research",
    "candidate sourcing",
    "signal monitoring",
    "workflow automation",
    "market intelligence",
  ],
  themeColor: "#08090D",
  locale: "en_US",
  socialImageAlt: "ContextKings social preview",
} as const;

function normalizeSiteUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";

  return normalizeSiteUrl(configuredUrl);
}

export function getMetadataBase() {
  return new URL(getSiteUrl());
}

export function getCanonicalUrl(path = "/") {
  return new URL(path, getMetadataBase()).toString();
}
