import type { Metadata } from "next";
import { ContextKingsApp } from "@/components/contextkings-app";
import { getCanonicalUrl, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "AI Research Workflow Builder",
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: getCanonicalUrl("/"),
    description: siteConfig.description,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: getCanonicalUrl("/"),
    description: siteConfig.description,
    featureList: [
      "Convert plain-English research goals into executable workflows",
      "Upload CSV, JSON, TXT, and XLSX files as workflow sources",
      "Build company research, prospecting, recruiting, and comparison workflows",
      "Save runs and revisit generated plans",
    ],
    keywords: siteConfig.keywords.join(", "),
  },
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <ContextKingsApp />
    </>
  );
}
