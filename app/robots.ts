import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/", "/favorites"],
      },
      {
        userAgent: "Googlebot-Image",
        allow: ["/og-image.png", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png"],
      },
    ],
    sitemap: "https://www.toolnestai.net/sitemap.xml",
    host: "https://www.toolnestai.net",
  };
}
