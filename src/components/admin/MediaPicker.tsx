"use client";
import { useEffect, useState } from "react";

type M = {
  id: string;
  url: string;
  title: string | null;
  alt: string | null;
  kind: string;
  width: number | null;
  height: number | null;
};

/** Choose an image from the media library, or upload new ones (optimised to WebP automatically). */
export default function MediaPicker({
  onPick,
  onClose,
}: {
  onPick: (m: { url: string; alt: string }) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<M[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = () =>
    fetch(`/api/admin/r/media?pageSize=100&f.kind=image&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.rows ?? []));
  useEffect(() => {
    load();
  }, [q]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr("");
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("file", f));
    const r = await fetch("/api/admin/media/upload", { method: "POST", body: fd });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) setErr(d.error ?? "Upload failed");
    else load();
  }
  return (
    <div
      className="drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Media library"
      onClick={onClose}
    >
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 style={{ margin: 0 }}>Choose an image</h2>
          <span className="spacer" />
          <button className="btn small" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="row" style={{ margin: "1rem 0" }}>
          <input
            placeholder="Search by title"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search images"
            style={{ flex: 1 }}
          />
          <label className="btn">
            {busy ? "Uploading…" : "Upload images"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              hidden
              onChange={(e) => upload(e.target.files)}
            />
          </label>
        </div>
        {err && <div className="alert error">{err}</div>}
        <p className="muted small">
          Uploads are converted to WebP in several sizes so pages load fast. Add alt text after
          choosing.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: ".6rem",
          }}
        >
          {items.map((m) => (
            <button
              key={m.id}
              onClick={() => onPick({ url: m.url, alt: m.alt ?? "" })}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 4,
                background: "#fff",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <img
                src={m.url.replace(/-full\.webp$/, "-w480.webp")}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = m.url;
                }}
                alt={m.alt ?? ""}
                style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 6 }}
              />
              <div
                className="small"
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {m.title}
              </div>
            </button>
          ))}
          {!items.length && <p className="muted">No images yet — upload some.</p>}
        </div>
      </div>
    </div>
  );
}
