"use client";
import { useEffect, useState } from "react";
import { ActionForm, api } from "./ui";

export default function AiStudio({ pages, currency }: { pages: { id: string; title: string }[]; currency: string }) {
  const [credits, setCredits] = useState<{ balanceMinor: number; providers: string[] } | null>(null);
  const [blog, setBlog] = useState({ topic: "", keyword: "", outline: "", questions: "", draft: "" }); const [busy, setBusy] = useState("");
  const load = () => api<{ balanceMinor: number; providers: string[] }>("/api/admin/credits").then(({ data }) => setCredits(data));
  useEffect(() => { load(); }, []);
  const fmt = (m: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(m / 100);
  async function step(s: "outline" | "questions" | "draft") {
    setBusy(s);
    const { ok, data } = await api<{ text: string; error?: string }>("/api/admin/ai/blog", "POST", { step: s, topic: blog.topic, keyword: blog.keyword, outline: blog.outline, questions: blog.questions });
    setBusy("");
    if (ok) setBlog({ ...blog, [s === "draft" ? "draft" : s]: data.text }); else alert(data.error);
  }
  async function saveDraft() {
    const { ok, data } = await api<{ id?: string; error?: string }>("/api/admin/r/blog-posts", "POST", { title: blog.topic, slug: blog.topic, html: blog.draft, focusKeyword: blog.keyword, status: "draft" });
    alert(ok ? "Saved as a draft blog post." : data.error);
  }
  return (
    <div>
      <h1>AI studio</h1>
      <p className="muted">Everything here uses only the knowledge you have approved. Credits are charged per use; mock mode (no AI key) is free and returns placeholders.</p>
      <div className="grid cols-2" style={{ marginTop: "1rem" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Credits</h3>
          <p className="stat">{credits ? fmt(credits.balanceMinor) : "…"}</p><p className="muted small">AI providers: {credits?.providers.join(", ")}</p>
          <ActionForm title="Buy credits" endpoint="/api/admin/credits" fields={[{ key: "amountMinor", label: "Amount (in pence/paise)", type: "number", default: 50000 }]} submitLabel="Buy" />
        </div>
        <ActionForm title="Generate content" endpoint="/api/admin/ai/generate" submitLabel="Generate" help="Saved to the Output library."
          fields={[{ key: "kind", label: "What to write", type: "select", options: ["faq", "usp", "ad_copy", "section", "sales_story", "email", "qa"], default: "faq" }, { key: "topic", label: "Product, page or topic", placeholder: "e.g. Remortgage advice for first-time buyers" }, { key: "tone", label: "Tone", placeholder: "friendly, expert" }, { key: "audience", label: "Audience" }, { key: "platform", label: "Platform", placeholder: "Google Ads, Meta, email…" }]}
          showResult={(d) => <pre style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: ".75rem", borderRadius: 8 }}>{String(d.body ?? "")}</pre>} />
        <ActionForm title="Add knowledge" endpoint="/api/admin/knowledge/add" submitLabel="Add" help="Chunks wait for approval in Knowledge chunks before the chatbot or generators use them."
          fields={[{ key: "type", label: "From", type: "select", options: ["text", "url"], default: "text" }, { key: "title", label: "Title" }, { key: "category", label: "Category", type: "select", options: ["business_info", "competitor", "market_intel", "qa"], default: "business_info" }, { key: "url", label: "Web page address (for URL)" }, { key: "text", label: "Text (for pasted text)", type: "textarea" }]} />
        <ActionForm title="Business interview link" endpoint="/api/admin/interviews" fields={[]} submitLabel="Create a new 14-day link" help="The owner answers one question at a time by typing or speaking. A new link replaces the old one."
          showResult={(d) => <p><a href={String(d.url)} target="_blank">{String(d.url)}</a></p>} />
        <ActionForm title="AI page builder" endpoint="/api/admin/ai/page-fill" submitLabel="Rewrite page copy" help="Rewrites the text of every section on a page; buttons, images and layout stay the same. Previous versions go to Content history."
          fields={[{ key: "pageId", label: "Page", type: "select", options: pages.map((p) => p.id), default: pages[0]?.id ?? "" }, { key: "keyword", label: "SEO keyword" }, { key: "tone", label: "Tone", default: "clear and friendly" }, { key: "goal", label: "Goal of the page", placeholder: "Get visitors to request a call back" }, { key: "brochureText", label: "Brochure text (optional)", type: "textarea" }]} />
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Blog writer</h3>
        <p className="muted small">Outline → research questions → full draft. Edit any step by hand before moving on.</p>
        <div className="grid cols-2"><div className="field"><label htmlFor="bt">Topic / title</label><input id="bt" value={blog.topic} onChange={(e) => setBlog({ ...blog, topic: e.target.value })} /></div><div className="field"><label htmlFor="bk">Focus keyword</label><input id="bk" value={blog.keyword} onChange={(e) => setBlog({ ...blog, keyword: e.target.value })} /></div></div>
        <div className="row"><button className="btn" disabled={!blog.topic || !!busy} onClick={() => step("outline")}>{busy === "outline" ? "Working…" : "1. Outline"}</button><button className="btn" disabled={!blog.outline || !!busy} onClick={() => step("questions")}>{busy === "questions" ? "Working…" : "2. Research questions"}</button><button className="btn" disabled={!blog.outline || !!busy} onClick={() => step("draft")}>{busy === "draft" ? "Writing…" : "3. Write draft"}</button><button className="btn primary" disabled={!blog.draft} onClick={saveDraft}>Save as blog draft</button></div>
        <div className="grid cols-2" style={{ marginTop: "1rem" }}>
          <div className="field"><label>Outline</label><textarea rows={10} value={blog.outline} onChange={(e) => setBlog({ ...blog, outline: e.target.value })} /></div>
          <div className="field"><label>Research questions</label><textarea rows={10} value={blog.questions} onChange={(e) => setBlog({ ...blog, questions: e.target.value })} /></div>
        </div>
        <div className="field"><label>Draft (HTML)</label><textarea rows={14} className="code" value={blog.draft} onChange={(e) => setBlog({ ...blog, draft: e.target.value })} /></div>
      </div>
    </div>
  );
}
