"use client";
import { ActionForm } from "./ui";

export default function SeoResearch() {
  return (
    <ActionForm title="QnA finder & Instagram search" endpoint="/api/admin/seo/research" submitLabel="Search" help="Finds real questions people ask (Quora, Reddit) or Instagram posts on a topic, using your search API key. Results are saved under Research results."
      fields={[{ key: "tool", label: "Tool", type: "select", options: ["qna", "instagram"], default: "qna" }, { key: "topic", label: "Keyword or topic" }, { key: "site", label: "Site (QnA)", type: "select", options: ["quora.com", "reddit.com", "stackexchange.com"], default: "quora.com" }, { key: "afterDate", label: "Only after (YYYY-MM-DD)" }, { key: "handle", label: "Instagram handle (optional)" }]}
      showResult={(d) => <ul className="small">{(d.results as { title: string; link: string }[] | undefined)?.map((r) => <li key={r.link}><a href={r.link} target="_blank" rel="noopener noreferrer">{r.title}</a></li>)}</ul>} />
  );
}
