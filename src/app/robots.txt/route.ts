import { withApiLog } from "@/lib/apiLogging";
import { siteForHost } from "@/lib/tenant";
import { getSetting } from "@/lib/settings";

async function handleGET(req: Request) {
  const site = await siteForHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  if (!site)
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: { "Content-Type": "text/plain" },
    });
  const { content } = await getSetting(site.id, "seo.robots");
  const body = content.includes("Sitemap:")
    ? content
    : `${content.trim()}\n\nSitemap: https://${site.domain}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain" } });
}

export const GET = withApiLog("/robots.txt", "GET", handleGET);
