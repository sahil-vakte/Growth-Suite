import { ctaHref, type Cta as CtaT } from "@/lib/engines/cta";
import { srcSetFor } from "@/lib/engines/srcset";

export function CtaButton({ cta, pageUrl, variant = "primary" }: { cta?: Partial<CtaT> | null; pageUrl: string; variant?: "primary" | "secondary" }) {
  const href = ctaHref(cta, pageUrl);
  if (!href || !cta) return null;
  const track = cta.type === "whatsapp" ? "whatsapp" : cta.type === "phone" || cta.type === "call" ? "call" : cta.type === "form" ? "form" : "link";
  return (
    <a className={`s-btn ${variant}`} href={href} target={cta.target === "_blank" ? "_blank" : undefined} rel={cta.target === "_blank" ? "noopener noreferrer" : undefined} data-track={track}>
      {cta.label}
    </a>
  );
}

export function Img({ image, className, priority }: { image?: { url?: string; alt?: string } | null; className?: string; priority?: boolean }) {
  if (!image?.url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  const srcSet = srcSetFor(image.url);
  return <img src={image.url} srcSet={srcSet} sizes={srcSet ? "(max-width: 820px) 100vw, 50vw" : undefined} alt={image.alt ?? ""} className={className} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" />;
}
