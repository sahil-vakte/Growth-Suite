import { cookies, headers } from "next/headers";
import { siteChrome, themeStyle, runtimeConfig, googleFontsHref } from "@/lib/site/render";
import { SiteHeader, SiteFooter } from "./Chrome";
import SiteRuntime from "./SiteRuntime";
import { getSetting } from "@/lib/settings";
import { db } from "@/db";
import { fontSets } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { SiteRow } from "@/lib/tenant";

/** Wraps every public page: theme variables, Google Fonts, GTM, header, footer and the browser runtime. */
export default async function SiteShell({ site, children, themeId, fontSetId, path }: { site: SiteRow; children: React.ReactNode; themeId?: string | null; fontSetId?: string | null; path: string }) {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const pageUrl = `${proto}://${h.get("host") ?? site.domain}${path}`;
  const vid = (await cookies()).get("gs_vid")?.value;
  const [style, chrome, runtime, gtm, design] = await Promise.all([themeStyle(site.id, themeId, fontSetId), siteChrome(site.id), runtimeConfig(site, vid, pageUrl), getSetting(site.id, "integrations.gtm"), getSetting(site.id, "site.design")]);
  const fid = fontSetId ?? design.fontSetId;
  const [fonts] = fid ? await db.select().from(fontSets).where(and(eq(fontSets.id, fid), eq(fontSets.siteId, site.id))).limit(1) : await db.select().from(fontSets).where(and(eq(fontSets.siteId, site.id), eq(fontSets.isDefault, true))).limit(1);
  const fontHref = fonts ? googleFontsHref(fonts.slots as Record<string, { family?: string }>) : null;
  const gtmId = /^GTM-[A-Z0-9]{4,10}$/.test(gtm.containerId) ? gtm.containerId : null;
  return (
    <div className="site" style={style as React.CSSProperties}>
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      {gtmId && <script dangerouslySetInnerHTML={{ __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');` }} />}
      <SiteHeader chrome={chrome} siteName={site.name} pageUrl={pageUrl} />
      <main>{children}</main>
      <SiteFooter chrome={chrome} siteName={site.name} />
      <SiteRuntime config={runtime} />
    </div>
  );
}
