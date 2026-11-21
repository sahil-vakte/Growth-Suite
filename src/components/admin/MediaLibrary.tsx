"use client";
import Link from "next/link";
import { useState } from "react";
import MediaPicker from "./MediaPicker";

export default function MediaLibrary() {
  const [picked, setPicked] = useState<string | null>(null); const [open, setOpen] = useState(true);
  return (
    <div>
      <div className="topbar"><h1>Media library</h1><span className="spacer" /><Link className="btn" href="/admin/r/media">Edit titles & alt text</Link><button className="btn primary" onClick={() => setOpen(true)}>Browse & upload</button></div>
      <p className="muted">Images are converted to WebP in several sizes on upload. PDFs up to 25 MB and MP4 videos are stored as they are.</p>
      {picked && <div className="alert info">Image address: <code>{picked}</code> <button className="btn small" onClick={() => navigator.clipboard.writeText(picked)}>Copy</button></div>}
      {open && <MediaPicker onClose={() => setOpen(false)} onPick={(m) => { setPicked(m.url); setOpen(false); }} />}
    </div>
  );
}
