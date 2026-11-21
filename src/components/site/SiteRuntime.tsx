"use client";
/** Browser runtime for public pages: first-party tracking, click attribution (WhatsApp Ref codes), dynamic call numbers,
 * popups with targeting and exit intent, floating CTA bar, chatbot widget and the YouTube facade. */
import { useEffect, useRef, useState } from "react";
import {
  shouldShow,
  frequencyAllows,
  needsExitIntent,
  EXIT_INTENT_GRACE_MS,
  type PopupCondition,
} from "@/lib/engines/popupTargeting";
import { pickNumber, type SourceRule } from "@/lib/engines/callTracking";
import { classifySource, detectDevice } from "@/lib/engines/attribution";
import { ctaHref, type Cta } from "@/lib/engines/cta";

export interface RuntimeConfig {
  popups: {
    id: string;
    layout: string;
    content: Record<string, unknown>;
    design: Record<string, string>;
    targeting: { match: "all" | "any"; conditions: PopupCondition[] };
    frequency: "session" | "once" | "always";
    delaySec: number;
    segmentId: string | null;
  }[];
  floating: {
    enabled: boolean;
    position: string;
    whatsappHref: string | null;
    callHref: string | null;
    formId: string | null;
    colors: { wa: string; call: string; form: string };
  } | null;
  call: { defaultPhone: string; rules: SourceRule[] } | null;
  chat: { id: string; config: Record<string, unknown> } | null;
  segments: string[];
}

const getCookie = (n: string) =>
  document.cookie
    .split("; ")
    .find((c) => c.startsWith(n + "="))
    ?.split("=")
    .slice(1)
    .join("=");
const setCookie = (n: string, v: string, days?: number) => {
  document.cookie = `${n}=${v}; path=/; SameSite=Lax${days ? `; max-age=${days * 86400}` : ""}${location.protocol === "https:" ? "; Secure" : ""}`;
};
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
};
const ss = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
};

function visitorId() {
  let v = getCookie("gs_vid");
  if (!v) {
    v = crypto.randomUUID().replace(/-/g, "");
    setCookie("gs_vid", v, 395);
  }
  return v;
}
function visitParams(): Record<string, string> {
  const stored: Record<string, string> = (() => {
    try {
      return JSON.parse(decodeURIComponent(getCookie("gs_params") ?? "") || "{}");
    } catch {
      return {};
    }
  })();
  new URLSearchParams(location.search).forEach((v, k) => {
    stored[k] = v.slice(0, 200);
  });
  setCookie("gs_params", encodeURIComponent(JSON.stringify(stored)));
  return stored;
}
function send(name: string, props?: Record<string, unknown>, beacon = false) {
  const body = JSON.stringify({
    name,
    visitorId: visitorId(),
    url: location.href,
    referrer: document.referrer || undefined,
    props,
    ids: {
      fbp: getCookie("_fbp"),
      fbc: getCookie("_fbc"),
      gaClientId: getCookie("_ga")?.split(".").slice(-2).join("."),
    },
  });
  if (beacon && navigator.sendBeacon)
    navigator.sendBeacon("/api/public/track", new Blob([body], { type: "application/json" }));
  else
    fetch("/api/public/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  (window as unknown as { dataLayer?: unknown[] }).dataLayer?.push({
    event: `cms_${name}`,
    ...props,
  });
}

export default function SiteRuntime({ config }: { config: RuntimeConfig }) {
  const [popup, setPopup] = useState<RuntimeConfig["popups"][number] | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const started = useRef(Date.now());
  const maxScroll = useRef(0);
  const exitFired = useRef(false);

  useEffect(() => {
    const params = visitParams();
    const sessionNew = !ss.get("gs_session");
    if (sessionNew) {
      ss.set("gs_session", "1");
      ls.set("gs_sessions", String(Number(ls.get("gs_sessions") ?? 0) + 1));
    }
    const isReturning = Number(ls.get("gs_sessions") ?? 1) > 1;
    send("page_view");

    // Scroll depth
    const marks = new Set<number>();
    const onScroll = () => {
      const h = document.documentElement;
      const pct = Math.round(((h.scrollTop + innerHeight) / h.scrollHeight) * 100);
      maxScroll.current = Math.max(maxScroll.current, pct);
      for (const m of [25, 50, 75, 100])
        if (pct >= m && !marks.has(m)) {
          marks.add(m);
          send("scroll", { depth: m });
        }
    };
    addEventListener("scroll", onScroll, { passive: true });
    const onHide = () => {
      if (document.visibilityState === "hidden")
        send(
          "time_on_page",
          { seconds: Math.round((Date.now() - started.current) / 1000), scroll: maxScroll.current },
          true,
        );
    };
    document.addEventListener("visibilitychange", onHide);

    // Dynamic call numbers (sticky 30 days)
    if (config.call?.defaultPhone) {
      const sticky = (() => {
        try {
          return JSON.parse(ls.get("gs_call") ?? "null");
        } catch {
          return null;
        }
      })();
      const phone = pickNumber(
        config.call.defaultPhone,
        config.call.rules,
        { params, referrer: document.referrer },
        sticky ?? undefined,
      );
      if (phone !== config.call.defaultPhone) {
        if (!sticky) ls.set("gs_call", JSON.stringify({ phone, at: Date.now() }));
        const digits = (s: string) => s.replace(/[^\d+]/g, "");
        document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach((a) => {
          if (digits(a.href.slice(4)) === digits(config.call!.defaultPhone)) {
            a.href = `tel:${digits(phone)}`;
            if (digits(a.textContent ?? "") === digits(config.call!.defaultPhone))
              a.textContent = phone;
          }
        });
      }
    }

    // Click attribution
    const onClick = async (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#form-")) return;
      const yt = a.getAttribute("data-yt");
      if (yt) {
        e.preventDefault();
        const f = document.createElement("iframe");
        f.src = `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`;
        f.allow = "autoplay; encrypted-media; picture-in-picture";
        f.allowFullscreen = true;
        f.title = "Video";
        f.style.cssText = "width:100%;aspect-ratio:16/9;border:0;border-radius:12px";
        a.replaceWith(f);
        send("video_play", { id: yt });
        return;
      }
      const kind = href.startsWith("tel:")
        ? "call"
        : /wa\.me|whatsapp\.com/.test(href)
          ? "whatsapp"
          : null;
      if (!kind) return;
      e.preventDefault();
      let target = href;
      try {
        const r = await fetch("/api/public/click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, visitorId: visitorId(), pageUrl: location.href, href }),
        });
        const d = await r.json();
        if (kind === "whatsapp" && d.refCode) {
          const u = new URL(href);
          const text = u.searchParams.get("text") ?? "";
          u.searchParams.set("text", `${text}${text ? " " : ""}(Ref: ${d.refCode})`);
          target = u.toString();
        }
      } catch {
        /* still open the link */
      }
      send(kind === "call" ? "call_click" : "whatsapp_click", { href: href.slice(0, 120) });
      if (kind === "whatsapp") window.open(target, "_blank", "noopener");
      else location.href = target;
    };
    document.addEventListener("click", onClick);

    // Popups
    const ctxBase = () => ({
      url: location.href,
      source: classifySource(params, document.referrer).source,
      device: detectDevice(navigator.userAgent),
      params,
      isReturning,
      paid: classifySource(params, document.referrer).paid,
      sessionCount: Number(ls.get("gs_sessions") ?? 1),
      timeOnPageSec: Math.round((Date.now() - started.current) / 1000),
      scrollDepth: maxScroll.current,
      exitIntent: exitFired.current,
      segments: config.segments,
    });
    const eligible = () =>
      config.popups.filter(
        (p) =>
          frequencyAllows(p.frequency, !!ls.get(`gs_pop_${p.id}`), !!ss.get(`gs_pop_${p.id}`)) &&
          (!p.segmentId || config.segments.includes(p.segmentId)),
      );
    const tryShow = (onlyExit: boolean) => {
      if (document.querySelector(".s-popup")) return;
      for (const p of eligible()) {
        if (needsExitIntent(p.targeting) !== onlyExit) continue;
        if (shouldShow(p.targeting, ctxBase())) {
          ls.set(`gs_pop_${p.id}`, "1");
          ss.set(`gs_pop_${p.id}`, "1");
          setPopup(p);
          send("popup_shown", { popup_id: p.id });
          return;
        }
      }
    };
    const timers = config.popups
      .filter((p) => !needsExitIntent(p.targeting))
      .map((p) => setTimeout(() => tryShow(false), p.delaySec * 1000));
    const recheck = setInterval(() => tryShow(false), 5000);
    let lastY = scrollY,
      lastT = Date.now();
    const exit = () => {
      if (exitFired.current || Date.now() - started.current < EXIT_INTENT_GRACE_MS) return;
      exitFired.current = true;
      tryShow(true);
    };
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 0) exit();
    };
    const onFastUp = () => {
      const now = Date.now();
      if (lastY - scrollY > 200 && now - lastT < 300 && scrollY > 400) exit();
      lastY = scrollY;
      lastT = now;
    };
    document.addEventListener("mouseout", onMouseOut);
    if (detectDevice(navigator.userAgent) !== "desktop")
      addEventListener("scroll", onFastUp, { passive: true });

    return () => {
      removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      document.removeEventListener("click", onClick);
      document.removeEventListener("mouseout", onMouseOut);
      removeEventListener("scroll", onFastUp);
      timers.forEach(clearTimeout);
      clearInterval(recheck);
    };
  }, [config]);

  const closePopup = (how: string) => {
    if (popup) send("popup_closed", { popup_id: popup.id, how });
    setPopup(null);
  };
  const f = config.floating;
  return (
    <>
      {popup && <Popup p={popup} onClose={closePopup} />}
      {f?.enabled && (
        <div
          className={`s-float ${f.position === "left" ? "left" : "right"}`}
          aria-label="Contact options"
        >
          {f.whatsappHref && (
            <a href={f.whatsappHref} style={{ background: f.colors.wa }} aria-label="WhatsApp">
              💬
            </a>
          )}
          {f.callHref && (
            <a href={f.callHref} style={{ background: f.colors.call }} aria-label="Call">
              📞
            </a>
          )}
          {f.formId && (
            <a
              href={`#form-${f.formId}`}
              style={{ background: f.colors.form }}
              aria-label="Enquiry form"
            >
              ✉️
            </a>
          )}
        </div>
      )}
      {config.chat && <ChatWidget widget={config.chat} open={chatOpen} setOpen={setChatOpen} />}
    </>
  );
}

function Popup({
  p,
  onClose,
}: {
  p: RuntimeConfig["popups"][number];
  onClose: (how: string) => void;
}) {
  const c = p.content as {
    headline?: string;
    body?: string;
    bullets?: string[];
    image?: { url?: string; alt?: string };
    cta?: Cta;
    countdown?: { enabled?: boolean; mode?: string; endAt?: string; minutes?: number };
  };
  const d = p.design;
  const [now, setNow] = useState(Date.now());
  const endAt = c.countdown?.enabled
    ? c.countdown.mode === "fixed" && c.countdown.endAt
      ? Date.parse(c.countdown.endAt)
      : (() => {
          const k = `gs_cd_${p.id}`;
          const v = Number(ls.get(k)) || Date.now() + (c.countdown?.minutes ?? 15) * 60000;
          ls.set(k, String(v));
          return v;
        })()
    : 0;
  useEffect(() => {
    if (!endAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endAt]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose("escape");
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  if (endAt && now >= endAt) return null;
  const left = Math.max(0, Math.floor((endAt - now) / 1000));
  const href = ctaHref(c.cta, location.href);
  return (
    <div
      className={`s-popup ${p.layout}`}
      role="dialog"
      aria-modal={p.layout === "center"}
      aria-label={c.headline || "Offer"}
      onClick={(e) => e.target === e.currentTarget && onClose("backdrop")}
    >
      <div className="s-popup-box" style={{ background: d.bg, color: d.text }}>
        <button className="s-popup-x" aria-label="Close" onClick={() => onClose("button")}>
          ×
        </button>
        {c.image?.url && <img src={c.image.url} alt={c.image.alt ?? ""} className="s-popup-img" />}
        {c.headline && <h2>{c.headline}</h2>}
        {c.body && <p>{c.body}</p>}
        {!!c.bullets?.length && (
          <ul className="s-ticks">
            {c.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
        {endAt > 0 && (
          <div className="s-countdown" aria-live="off">
            {Math.floor(left / 3600) > 0 && `${Math.floor(left / 3600)}h `}
            {Math.floor((left % 3600) / 60)}m {left % 60}s
          </div>
        )}
        {href && c.cta && (
          <a
            className="s-btn primary"
            href={href}
            style={{ background: d.button, color: d.buttonText }}
            onClick={() => {
              send("popup_click", { popup_id: p.id });
              if (href.startsWith("#")) onClose("cta");
            }}
          >
            {c.cta.label}
          </a>
        )}
      </div>
    </div>
  );
}

function ChatWidget({
  widget,
  open,
  setOpen,
}: {
  widget: { id: string; config: Record<string, unknown> };
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const cfg = widget.config as {
    botName?: string;
    greeting?: string;
    themeColor?: string;
    position?: string;
  };
  const [msgs, setMsgs] = useState<{ role: "bot" | "user"; text: string }[]>([
    { role: "bot", text: cfg.greeting || "Hi! How can I help?" },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const conv = useRef<string | null>(null);
  async function sendMsg(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setText("");
    setBusy(true);
    try {
      const r = await fetch(`/api/public/chat/${widget.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: t,
          conversationId: conv.current,
          visitorId: visitorId(),
          pageUrl: location.href,
        }),
      });
      const d = await r.json();
      conv.current = d.conversationId ?? conv.current;
      setMsgs((m) => [
        ...m,
        { role: "bot", text: d.reply ?? d.error ?? "Sorry, something went wrong." },
      ]);
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: "Connection problem — please try again." }]);
    }
    setBusy(false);
  }
  return (
    <div className={`s-chat ${cfg.position === "left" ? "left" : "right"}`}>
      {open && (
        <div className="s-chat-panel" role="dialog" aria-label={cfg.botName || "Chat"}>
          <div className="s-chat-head" style={{ background: cfg.themeColor }}>
            {cfg.botName || "Chat"}
            <button aria-label="Minimise chat" onClick={() => setOpen(false)}>
              –
            </button>
          </div>
          <div className="s-chat-body" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`s-msg ${m.role}`}>
                {m.text}
              </div>
            ))}
            {busy && <div className="s-msg bot">…</div>}
          </div>
          <form className="s-chat-form" onSubmit={sendMsg}>
            <input
              aria-label="Message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message…"
              maxLength={1000}
            />
            <button className="s-btn primary" disabled={busy}>
              Send
            </button>
          </form>
        </div>
      )}
      <button
        className="s-chat-launch"
        style={{ background: cfg.themeColor }}
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => {
          setOpen(!open);
          if (!open) send("chat_open");
        }}
      >
        💬
      </button>
    </div>
  );
}
