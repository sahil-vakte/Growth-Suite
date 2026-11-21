import { ctaHref } from "@/lib/engines/cta";
import { CtaButton } from "./Cta";
import MobileMenuToggle from "./MobileMenuToggle";
import type { siteChrome } from "@/lib/site/render";

type ChromeData = Awaited<ReturnType<typeof siteChrome>>;

export function SiteHeader({
  chrome,
  siteName,
  pageUrl,
}: {
  chrome: ChromeData;
  siteName: string;
  pageUrl: string;
}) {
  const { header, menu, links } = chrome;
  if (!header.enabled) return null;
  const brand = header.logoLabel || menu.brandLabel || siteName;
  const logo = header.logoUrl || menu.brandLogo;
  return (
    <header className={`s-header${menu.sticky ? "" : " static"}`}>
      {header.announcement && <div className="s-announce">{header.announcement}</div>}
      <div className="s-wrap s-nav" id="site-nav">
        <a href="/" className="s-brand">
          {logo ? <img src={logo} alt={header.logoAlt || brand} /> : null}
          <span>{logo ? "" : brand}</span>
        </a>
        <ul className="s-links">
          {links.map((l) => (
            <li key={l.id}>
              <a href={l.href}>
                {l.icon ? `${l.icon} ` : ""}
                {l.label}
              </a>
              {l.children.length > 0 && (
                <ul>
                  {l.children.map((c) => (
                    <li key={c.id}>
                      <a href={c.href}>{c.label}</a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {menu.blog.enabled && (
            <li>
              <a href="/blog">{menu.blog.label}</a>
            </li>
          )}
        </ul>
        {header.phone && (
          <a
            href={`tel:${header.phone.replace(/[^\d+]/g, "")}`}
            className="s-muted"
            data-track="call"
          >
            {header.phone}
          </a>
        )}
        {ctaHref(menu.cta as never, pageUrl) ? (
          <CtaButton cta={menu.cta as never} pageUrl={pageUrl} />
        ) : (
          <CtaButton cta={header.cta1 as never} pageUrl={pageUrl} />
        )}
        <MobileMenuToggle />
      </div>
    </header>
  );
}

export function SiteFooter({ chrome, siteName }: { chrome: ChromeData; siteName: string }) {
  const f = chrome.footer;
  return (
    <footer className="s-footer">
      <div className="s-wrap s-cols">
        <div>
          <h3>{siteName}</h3>
          {f.brandText && <p>{f.brandText}</p>}
        </div>
        <div>
          {f.address && <p style={{ whiteSpace: "pre-line" }}>{f.address}</p>}
          {f.phone && (
            <p>
              <a href={`tel:${f.phone.replace(/[^\d+]/g, "")}`} data-track="call">
                {f.phone}
              </a>
            </p>
          )}
          {f.email && (
            <p>
              <a href={`mailto:${f.email}`}>{f.email}</a>
            </p>
          )}
        </div>
        <div>
          {chrome.links.slice(0, 8).map((l) => (
            <p key={l.id} style={{ margin: ".3rem 0" }}>
              <a href={l.href}>{l.label}</a>
            </p>
          ))}
        </div>
        <div>
          {f.social.map((s) => (
            <p key={s.url} style={{ margin: ".3rem 0" }}>
              <a href={s.url} rel="noopener noreferrer" target="_blank">
                {s.network}
              </a>
            </p>
          ))}
          {f.legalLinks.map((l) => (
            <p key={l.href} style={{ margin: ".3rem 0" }}>
              <a href={l.href}>{l.label}</a>
            </p>
          ))}
        </div>
      </div>
      <div className="s-wrap" style={{ marginTop: "2rem", fontSize: ".85rem" }}>
        {f.copyright || `© ${new Date().getFullYear()} ${siteName}`}
      </div>
    </footer>
  );
}
