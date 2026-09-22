import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/meetings", "/profile", "/chat", "/dashboard", "/login", "/register"],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
