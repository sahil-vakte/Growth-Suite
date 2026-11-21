/** Allow-list HTML sanitiser for blog/product content written in the admin (defence in depth against stored XSS). */
const ALLOWED = new Set(["p", "br", "h2", "h3", "h4", "ul", "ol", "li", "strong", "b", "em", "i", "u", "a", "blockquote", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "hr", "code", "pre", "span", "div"]);
const ATTRS: Record<string, string[]> = { a: ["href", "title", "rel", "target"], img: ["src", "alt", "width", "height", "loading"], th: ["colspan", "rowspan"], td: ["colspan", "rowspan"] };

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|svg|math|template|noscript)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, tag: string, attrs: string) => {
      const t = tag.toLowerCase();
      if (!ALLOWED.has(t)) return "";
      if (full.startsWith("</")) return `</${t}>`;
      const allowed = ATTRS[t] ?? [];
      const kept: string[] = [];
      for (const m of attrs.matchAll(/([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
        const name = m[1].toLowerCase(); const val = m[3] ?? m[4] ?? m[5] ?? "";
        if (!allowed.includes(name)) continue;
        if ((name === "href" || name === "src") && !/^(https?:|mailto:|tel:|\/|#)/i.test(val.trim())) continue;
        kept.push(`${name}="${val.replace(/"/g, "&quot;")}"`);
      }
      if (t === "a" && kept.some((k) => k.startsWith('target="_blank"'))) kept.push('rel="noopener noreferrer"');
      return `<${t}${kept.length ? " " + kept.join(" ") : ""}>`;
    });
}
