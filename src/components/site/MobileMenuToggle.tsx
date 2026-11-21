"use client";
export default function MobileMenuToggle() {
  return <button className="s-menu-toggle" aria-label="Menu" aria-controls="site-nav" onClick={(e) => { const nav = (e.currentTarget as HTMLElement).closest(".s-nav"); const open = nav?.classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", String(!!open)); }}>☰</button>;
}
