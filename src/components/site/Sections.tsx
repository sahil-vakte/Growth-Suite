import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, products, reviews } from "@/db/schema";
import { CtaButton, Img } from "./Cta";
import FormEmbed from "./FormEmbed";

type C = Record<string, unknown>;
type Item = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");
const items = (c: C) => (Array.isArray(c.items) ? (c.items as Item[]) : []);

function youTubeId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

export async function SectionView({
  layoutKey,
  content: c,
  siteId,
  pageUrl,
  sectionId,
  isFirst,
  currency,
}: {
  layoutKey: string;
  content: C;
  siteId: string;
  pageUrl: string;
  sectionId: string;
  isFirst: boolean;
  currency: string;
}) {
  const id = `s-${sectionId}`;
  switch (layoutKey) {
    case "hero_split":
      return (
        <section id={id} className="s-sec s-hero split">
          <div className="s-wrap s-grid2">
            <div>
              {s(c.eyebrow) && <p className="s-eyebrow">{s(c.eyebrow)}</p>}
              <h1>{s(c.heading)}</h1>
              {s(c.subheading) && <p className="s-lead">{s(c.subheading)}</p>}
              {Array.isArray(c.bullets) && (
                <ul className="s-ticks">
                  {(c.bullets as string[]).filter(Boolean).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              <div className="s-actions">
                <CtaButton cta={c.primaryCta as never} pageUrl={pageUrl} />
                <CtaButton cta={c.secondaryCta as never} pageUrl={pageUrl} variant="secondary" />
              </div>
            </div>
            <div>
              <Img image={c.image as never} className="s-hero-img" priority={isFirst} />
            </div>
          </div>
        </section>
      );
    case "hero_centered": {
      const bg = (c.backgroundImage as { url?: string })?.url;
      return (
        <section
          id={id}
          className={`s-sec s-hero centered${bg ? " has-bg" : ""}`}
          style={
            bg
              ? {
                  backgroundImage: `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url("${encodeURI(bg)}")`,
                }
              : undefined
          }
        >
          <div className="s-wrap s-center">
            {s(c.eyebrow) && <p className="s-eyebrow">{s(c.eyebrow)}</p>}
            <h1>{s(c.heading)}</h1>
            {s(c.subheading) && <p className="s-lead">{s(c.subheading)}</p>}
            <div className="s-actions center">
              <CtaButton cta={c.primaryCta as never} pageUrl={pageUrl} />
              <CtaButton cta={c.secondaryCta as never} pageUrl={pageUrl} variant="secondary" />
            </div>
          </div>
        </section>
      );
    }
    case "rich_text":
      return (
        <section id={id} className="s-sec">
          <div
            className="s-wrap s-narrow"
            style={{ textAlign: c.align === "center" ? "center" : "left" }}
          >
            {s(c.heading) && <h2>{s(c.heading)}</h2>}
            {s(c.body)
              .split(/\n{2,}/)
              .map((p, i) => (
                <p key={i} style={{ whiteSpace: "pre-line" }}>
                  {p}
                </p>
              ))}
          </div>
        </section>
      );
    case "features_grid":
      return (
        <section id={id} className="s-sec">
          <div className="s-wrap">
            {s(c.heading) && <h2 className="s-center">{s(c.heading)}</h2>}
            {s(c.subheading) && <p className="s-center s-muted">{s(c.subheading)}</p>}
            <div className="s-cards">
              {items(c).map((it, i) => (
                <div key={i} className="s-card">
                  <Img image={it.image as never} className="s-card-img" />
                  {s(it.icon) && (
                    <div className="s-icon" aria-hidden>
                      {s(it.icon)}
                    </div>
                  )}
                  <h3>{s(it.title)}</h3>
                  <p>{s(it.text)}</p>
                </div>
              ))}
            </div>
            <div className="s-actions center">
              <CtaButton cta={c.primaryCta as never} pageUrl={pageUrl} />
            </div>
          </div>
        </section>
      );
    case "steps":
      return (
        <section id={id} className="s-sec alt">
          <div className="s-wrap">
            {s(c.heading) && <h2 className="s-center">{s(c.heading)}</h2>}
            <ol className="s-steps">
              {items(c).map((it, i) => (
                <li key={i}>
                  <span className="s-step-no">{i + 1}</span>
                  <h3>{s(it.title)}</h3>
                  <p>{s(it.text)}</p>
                </li>
              ))}
            </ol>
            <div className="s-actions center">
              <CtaButton cta={c.primaryCta as never} pageUrl={pageUrl} />
            </div>
          </div>
        </section>
      );
    case "stats":
      return (
        <section id={id} className="s-sec alt">
          <div className="s-wrap s-stats">
            {items(c).map((it, i) => (
              <div key={i}>
                <div className="s-stat">{s(it.value)}</div>
                <div className="s-muted">{s(it.label)}</div>
              </div>
            ))}
          </div>
        </section>
      );
    case "testimonials":
      return (
        <section id={id} className="s-sec">
          <div className="s-wrap">
            {s(c.heading) && <h2 className="s-center">{s(c.heading)}</h2>}
            <div className="s-cards">
              {items(c).map((it, i) => (
                <figure key={i} className="s-card s-quote">
                  {Number(it.rating) > 0 && (
                    <div className="s-stars" aria-label={`${it.rating} out of 5`}>
                      {"★".repeat(Math.min(5, Number(it.rating)))}
                    </div>
                  )}
                  <blockquote>{s(it.quote)}</blockquote>
                  <figcaption>
                    <Img image={it.image as never} className="s-avatar" />
                    <strong>{s(it.name)}</strong>
                    {s(it.role) && <span className="s-muted"> · {s(it.role)}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );
    case "reviews_live": {
      const rows = await db
        .select()
        .from(reviews)
        .where(and(eq(reviews.siteId, siteId), eq(reviews.status, "approved")))
        .orderBy(reviews.sortOrder)
        .limit(Number(c.max) || 6);
      if (!rows.length) return null;
      return (
        <section id={id} className="s-sec">
          <div className="s-wrap">
            {s(c.heading) && <h2 className="s-center">{s(c.heading)}</h2>}
            <div className="s-cards">
              {rows.map((r) => (
                <figure key={r.id} className="s-card s-quote">
                  {r.rating ? <div className="s-stars">{"★".repeat(r.rating)}</div> : null}
                  {r.text && <blockquote>{r.text}</blockquote>}
                  {r.audioUrl && <audio controls src={r.audioUrl} preload="none" />}
                  <figcaption>
                    <strong>{r.name}</strong>
                    {r.fields.city && <span className="s-muted"> · {r.fields.city}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );
    }
    case "faq": {
      const list = items(c);
      const schema = c.addSchema
        ? {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: list.map((q) => ({
              "@type": "Question",
              name: s(q.q),
              acceptedAnswer: { "@type": "Answer", text: s(q.a) },
            })),
          }
        : null;
      return (
        <section id={id} className="s-sec">
          <div className="s-wrap s-narrow">
            {s(c.heading) && <h2 className="s-center">{s(c.heading)}</h2>}
            {list.map((q, i) => (
              <details key={i} className="s-faq">
                <summary>{s(q.q)}</summary>
                <p>{s(q.a)}</p>
              </details>
            ))}
            {schema && (
              <script
                nonce={(await headers()).get("x-nonce") ?? undefined}
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
                }}
              />
            )}
          </div>
        </section>
      );
    }
    case "pricing":
      return (
        <section id={id} className="s-sec alt">
          <div className="s-wrap">
            {s(c.heading) && <h2 className="s-center">{s(c.heading)}</h2>}
            <div className="s-cards">
              {items(c).map((it, i) => (
                <div key={i} className={`s-card s-plan${it.highlight ? " hl" : ""}`}>
                  <h3>{s(it.name)}</h3>
                  <div className="s-price">
                    {s(it.price)}
                    <span className="s-muted">{s(it.period)}</span>
                  </div>
                  <ul className="s-ticks">
                    {(Array.isArray(it.features) ? (it.features as string[]) : []).map((f, k) => (
                      <li key={k}>{f}</li>
                    ))}
                  </ul>
                  <CtaButton cta={it.primaryCta as never} pageUrl={pageUrl} />
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case "cta_banner":
      return (
        <section id={id} className="s-sec s-banner">
          <div className="s-wrap s-center">
            <h2>{s(c.heading)}</h2>
            {s(c.text) && <p>{s(c.text)}</p>}
            <div className="s-actions center">
              <CtaButton cta={c.primaryCta as never} pageUrl={pageUrl} />
              <CtaButton cta={c.secondaryCta as never} pageUrl={pageUrl} variant="secondary" />
            </div>
          </div>
        </section>
      );
    case "form_embed":
      return (
        <section id={id} className="s-sec alt">
          <div className="s-wrap s-grid2">
            <div>
              <h2>{s(c.heading)}</h2>
              {s(c.text) && <p>{s(c.text)}</p>}
              {Array.isArray(c.bullets) && (
                <ul className="s-ticks">
                  {(c.bullets as string[]).filter(Boolean).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              <Img image={c.image as never} className="s-hero-img" />
            </div>
            <div className="s-card">
              {s(c.formId) ? (
                <FormEmbed formId={s(c.formId)} siteId={siteId} />
              ) : (
                <p className="s-muted">Choose a form for this section.</p>
              )}
            </div>
          </div>
        </section>
      );
    case "gallery":
      return (
        <section id={id} className="s-sec">
          <div className="s-wrap">
            {s(c.heading) && <h2 className="s-center">{s(c.heading)}</h2>}
            <div className="s-gallery">
              {items(c)
                .filter((it) => (it.image as { url?: string })?.url)
                .map((it, i) => (
                  <figure key={i}>
                    <Img image={it.image as never} />
                    {s(it.caption) && <figcaption className="s-muted">{s(it.caption)}</figcaption>}
                  </figure>
                ))}
            </div>
          </div>
        </section>
      );
    case "video": {
      const url = s(c.videoUrl);
      if (!url) return null;
      const yt = c.videoType === "youtube" ? youTubeId(url) : null;
      return (
        <section id={id} className="s-sec">
          <div className="s-wrap s-narrow">
            {s(c.heading) && <h2 className="s-center">{s(c.heading)}</h2>}
            {yt ? (
              <a
                className="s-yt"
                href={`https://www.youtube.com/watch?v=${yt}`}
                data-yt={yt}
                style={{ backgroundImage: `url(https://i.ytimg.com/vi/${yt}/hqdefault.jpg)` }}
                aria-label="Play video"
              >
                <span>▶</span>
              </a>
            ) : (
              <video
                controls
                preload="metadata"
                src={url}
                style={{ width: "100%", borderRadius: 12 }}
              />
            )}
            {s(c.caption) && <p className="s-center s-muted">{s(c.caption)}</p>}
          </div>
        </section>
      );
    }
    case "logo_strip":
      return (
        <section id={id} className="s-sec">
          <div className="s-wrap s-center">
            {s(c.heading) && <p className="s-eyebrow">{s(c.heading)}</p>}
            <div className="s-logos">
              {items(c).map((it, i) =>
                (it.image as { url?: string })?.url ? (
                  <Img key={i} image={it.image as never} />
                ) : (
                  <span key={i} className="s-muted">
                    {s(it.name)}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>
      );
    case "contact_split":
      return (
        <section id={id} className="s-sec alt">
          <div className="s-wrap s-grid2">
            <div>
              <h2>{s(c.heading)}</h2>
              {s(c.address) && <p style={{ whiteSpace: "pre-line" }}>{s(c.address)}</p>}
              {s(c.phone) && (
                <p>
                  <a href={`tel:${s(c.phone).replace(/[^\d+]/g, "")}`} data-track="call">
                    {s(c.phone)}
                  </a>
                </p>
              )}
              {s(c.email) && (
                <p>
                  <a href={`mailto:${s(c.email)}`}>{s(c.email)}</a>
                </p>
              )}
              {s(c.hours) && <p className="s-muted">{s(c.hours)}</p>}
              <CtaButton cta={c.primaryCta as never} pageUrl={pageUrl} />
            </div>
            <div className="s-card">
              {s(c.formId) ? <FormEmbed formId={s(c.formId)} siteId={siteId} /> : null}
            </div>
          </div>
        </section>
      );
    case "latest_blogs": {
      const posts = await db
        .select()
        .from(blogPosts)
        .where(and(eq(blogPosts.siteId, siteId), eq(blogPosts.status, "published")))
        .orderBy(desc(blogPosts.publishedAt))
        .limit(Number(c.max) || 3);
      if (!posts.length) return null;
      return (
        <section id={id} className="s-sec">
          <div className="s-wrap">
            {s(c.heading) && <h2 className="s-center">{s(c.heading)}</h2>}
            <div className="s-cards">
              {posts.map((p) => (
                <a key={p.id} href={`/blog/${p.slug}`} className="s-card s-link-card">
                  <h3>{p.title}</h3>
                  <p className="s-muted">{p.excerpt ?? p.metaDescription ?? ""}</p>
                </a>
              ))}
            </div>
          </div>
        </section>
      );
    }
    case "products_grid": {
      const list = await db
        .select()
        .from(products)
        .where(and(eq(products.siteId, siteId), eq(products.status, "active")))
        .orderBy(products.sortOrder)
        .limit(Number(c.max) || 6);
      if (!list.length) return null;
      const fmt = (m: number, cur: string) =>
        new Intl.NumberFormat("en-GB", { style: "currency", currency: cur || currency }).format(
          m / 100,
        );
      return (
        <section id={id} className="s-sec">
          <div className="s-wrap">
            {s(c.heading) && <h2 className="s-center">{s(c.heading)}</h2>}
            <div className="s-cards">
              {list.map((p) => (
                <a key={p.id} href={`/shop/${p.slug}`} className="s-card s-link-card">
                  {p.imageUrl && (
                    <Img image={{ url: p.imageUrl, alt: p.name }} className="s-card-img" />
                  )}
                  <h3>{p.name}</h3>
                  <div>
                    <strong>{fmt(p.priceMinor, p.currency)}</strong>
                    {p.compareAtMinor && p.compareAtMinor > p.priceMinor ? (
                      <s className="s-muted" style={{ marginLeft: 8 }}>
                        {fmt(p.compareAtMinor, p.currency)}
                      </s>
                    ) : null}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      );
    }
    default:
      return null;
  }
}
