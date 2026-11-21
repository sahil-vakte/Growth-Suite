"use client";
import { useEffect, useRef, useState } from "react";

type SR = { start: () => void; stop: () => void; onresult: (e: { results: { 0: { transcript: string }; isFinal: boolean }[] }) => void; continuous: boolean; interimResults: boolean; lang: string };

/** One question at a time; answers save as they go. Voice answers use the browser's speech recognition where available. */
export default function InterviewClient({ token }: { token: string }) {
  const [d, setD] = useState<{ questions: string[]; answers: Record<string, string>; language: string } | null>(null); const [err, setErr] = useState("");
  const [i, setI] = useState(0); const [text, setText] = useState(""); const [saved, setSaved] = useState(false); const [listening, setListening] = useState(false);
  const rec = useRef<SR | null>(null);
  useEffect(() => { fetch(`/api/public/interview/${token}`).then(async (r) => { const j = await r.json(); if (r.ok) { setD(j); const first = j.questions.findIndex((_: string, k: number) => !j.answers[k]); setI(first < 0 ? 0 : first); setText(j.answers[first < 0 ? 0 : first] ?? ""); } else setErr(j.error); }); }, [token]);
  if (err) return <p>{err}</p>; if (!d) return <p className="s-muted">Loading…</p>;
  async function save(next: number) { await fetch(`/api/public/interview/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ index: i, answer: text }) }); d!.answers[i] = text; setSaved(true); setTimeout(() => setSaved(false), 1500); if (next >= 0 && next < d!.questions.length) { setI(next); setText(d!.answers[next] ?? ""); } }
  function voice() {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const C = W.SpeechRecognition ?? W.webkitSpeechRecognition; if (!C) { alert("Voice answers need Chrome or Edge. You can always type."); return; }
    if (listening) { rec.current?.stop(); setListening(false); return; }
    const r = new C(); r.continuous = true; r.interimResults = false; r.lang = d!.language;
    r.onresult = (e) => { const t = Array.from(e.results).filter((x) => x.isFinal).map((x) => x[0].transcript).join(" "); setText((p) => (p ? p + " " : "") + t); };
    r.start(); rec.current = r; setListening(true);
  }
  const done = Object.keys(d.answers).filter((k) => d.answers[k]).length;
  return (
    <div>
      <p className="s-muted">Question {i + 1} of {d.questions.length} · {done} answered</p>
      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, marginBottom: "1.5rem" }}><div style={{ height: 6, width: `${(done / d.questions.length) * 100}%`, background: "var(--p)", borderRadius: 3 }} /></div>
      <h2>{d.questions[i]}</h2>
      <textarea aria-label="Your answer" value={text} onChange={(e) => setText(e.target.value)} rows={8} style={{ width: "100%", padding: ".8rem", borderRadius: 10, border: "1px solid #e2e8f0", font: "inherit" }} />
      <div className="s-actions"><button className="s-btn secondary" type="button" onClick={voice}>{listening ? "■ Stop recording" : "🎤 Answer by voice"}</button><button className="s-btn secondary" type="button" disabled={i === 0} onClick={() => save(i - 1)}>Back</button><button className="s-btn secondary" type="button" onClick={() => { setText(""); save(i + 1); }}>Skip</button><button className="s-btn primary" type="button" onClick={() => save(i + 1)}>{i === d.questions.length - 1 ? "Save" : "Save & next"}</button></div>
      {saved && <p className="s-muted" role="status">Saved.</p>}
      <p className="s-muted" style={{ marginTop: "2rem" }}>Your answers save as you go — you can close this page and come back with the same link.</p>
    </div>
  );
}
