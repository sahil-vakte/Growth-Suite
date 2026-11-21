# Audit notes — angela.lipsindia.com (product name: YAGOPS)

Source: /public/admin/docs_view.php?doc=feature-map (updated 2026-11-10), read 2026-11-21. Notes are paraphrased.

## What it is
Self-hosted PHP marketing CMS ("YAGOPS") installed on each client's own domain/server. Each installation talks to a
central "AI Engine" (aiengine.lipsindia.com) which provides: AI credits (Claude/OpenAI), central CRM (SSO), module
licensing (signed statements, checked ~2x/day, 14-day grace), WhatsApp scheduler/sending, partner business ID for Meta,
release distribution (master site builds release -> client sites apply updates). MCP connector ("CMS Personal Assistant")
exposes ~220 tools in 26 groups with Off/Read/Write per group, OAuth client id/secret, optional admin approval.

## Modules (menu order)
- Pages & Page Builder: list (All/Published/Draft, sort), create/duplicate/delete/publish; draft = 404 to public, admin preview bar;
  admin-edited pages locked for editors (editors duplicate); SEO title/description/schema; global theme+font set.
  Section editor: add/reorder/duplicate/delete; text, images (alt/title), videos, buttons linking to form/WhatsApp/call CTA;
  per-section theme/font/layout; audience rule on URL params (remembered per visit); page/section style JSON copy/paste.
- Blog: posts list publish/unpublish/delete; SEO & links card (category, pillar, course box page, meta desc, focus keyword, FAQ,
  related); categories; /blog, /blog/category/<slug>; schema BlogPosting/Breadcrumb/FAQ; paste->HTML; rich editor; clean artifacts.
  AI writer: 2 agents propose outlines, merge; fetch Google AI Mode points; research questions; write with model; prompts editable
  with history/undo/reset; background job; credits.
- Manage Content: Sections library (hero, accordion, tabs, grid cards, icon cards, testimonials, price, compare, sliders, video,
  bullets, CTA, education, real estate, planner...); preview with themes. Images: bulk upload -> WebP, library, alt/title, PDF docs
  (25MB, /uploads/documents). Common Content: section templates (from section or JSON). Favicon. Content History: auto snapshot
  before every change/delete, last 3 versions, filter, restore (restoring snapshots current first), who (email or AI).
  Generate Layout with AI: text/screenshot -> installable layout, preview, iterate, AI review, auto-fix, versions, Pending/Approved/Rejected.
- Themes & Fonts: colour themes (JSON copy/paste, scan colours), font sets (Google/custom, up to 12 roles), apply site-wide.
  Brand Typography: guidelines file template download/upload, read by AI.
- Menu/Header/Footer: home page, links from pages/URLs, nested, mega panels, icons; brand label/logo; blog home; menu CTA
  (page/form/WhatsApp/call); menu design + sticky; appearance (colours, fonts, logo height). Header layout, announcement strip,
  contact email/phone/WhatsApp, 2 CTAs. Footer layout: brand text, address, phone, email, social, sitemap links, legal, copyright.
- Forms: builder, embed code, field types/options/placeholders/col widths/conditional logic; calculator mode (formulas, prefix/suffix,
  live lookups via AI Engine); after-submit message/redirect; forwarding to verified emails + webhooks; WhatsApp OTP; test-form flag.
  Form Designer: templates, font set, eyebrow/headline/subhead/button, 13 colours, JSON copy/paste. Submissions: by form/date, page
  URL, CSV, visitor journey from analytics. Spam guard: honeypot, timer, hourly limits per IP/phone/email, junk text; held entries
  don't create lead/WA/conversions; restore/delete; switch.
- WhatsApp (click-to-chat): multiple numbers; named CTAs with prefilled message incl. page URL; buttons follow CTA live; click log.
- WhatsApp Business (Cloud API): connect Phone Number ID + WABA; templates builder (header text/media, body, footer, buttons,
  variables, fallbacks, Meta rule checks, drafts, sync); variables (auto lead/form/page + custom); automations (triggers: form,
  new lead, stage change, keyword, appointment booked, WA verification, lead score; delay; re-checked conditions; quiet hours;
  skip if replied; daily limit; once per person; STOP; on/off; run history; scheduler on AI Engine); campaigns (segment by
  stage/source/form/dates/verified/replied; throttle; preview; test send; confirm count; pause/resume/cancel; delivered/read/replied;
  STOP excluded); bot auto-replies (keywords->answer, handoff, greeting, no-answer, away hours, media answer; up to 5 attachments:
  image, doc, video, voice, sticker, location, contact, 3 reply buttons, list of 10, link button, carousel; quiet period 0-72h;
  daily limit; try-it box; log); Website chat widget that opens WhatsApp (number, header, greeting, picture, corner, colours,
  pages/devices, open trigger: immediate/delay/scroll/exit/never, snooze, URL param audience, multiple widgets);
  ad signals from bot answers (Meta/GA conversion or Meta custom audience event, once per customer).
- Social Posting: Accounts (partner business ID, instructions per Meta asset; connect Page by ID, verify via About-text code or
  team approval; 1 Page per site); Create post (FB/IG, photo/video MP4 chunked upload, live preview, caption tools: emoji,
  insert site links/phones/WA; IG limits; 9:16 -> Reel; padding non-IG ratios; partial failure handling); uploaded files library;
  schedule (quick buttons, user TZ, 6h expiry); calendar + queue + history (change time/post now/cancel/retry); roles
  executive/publisher/approver, approval workflow with notes + history, "publishers need approval" switch; settings (default
  hashtags, UTM link tracking); WhatsApp alerts for approvals (templates, retries x3, 24h drop); assistant drafts (as executive).
- Click to Call: default number + named CTAs; click log; dynamic number insertion by source (gclid, fb, utm_source, utm_medium,
  referrer, URL param), first rule wins, 30-day stickiness, dataLayer event cms_call_source_click.
- Floating CTA: side bar WhatsApp/Call/Form, on/off, position, colours, CTA + form choice.
- Appointments: timezone, slot length, min notice, booking window; services (duration, buffer, price INR); staff (email, phone,
  Google Calendar, weekly hours); booking form; bookings with status.
- Popups: bottom banner or central modal/bottom-sheet; background image/colour+tint; text layer; countdown (fixed or per visitor);
  button -> form/WA/call/page/URL/download; delay & frequency; targeting conditions (all/any): URL, source, device, new/returning,
  paid, UTM, session count, time on page, scroll depth, exit intent (desktop cursor / mobile fast scroll-up; ignore first 3s);
  audience segment; tracking shown/countdown/closed/clicked.
- Chatbot (AI): widgets (name, model, purpose, greeting, instructions, colours, avatar, launcher, look & feel, page scope + URL
  rules, Knowledge Brain filters, handoff WA/phone/URL/form); conversations (intent, score, status, contact, CRM link, top leads);
  chats -> leads (match phone then email, source "Website chat", backfill button); training Q&A (CSV/Excel import, embeddings);
  reply templates; automation rules (score/intent/keyword/message count -> template/WA/call/URL); intent groups + phrases + points.
- Audiences: segment builder from behaviour (visits, time on site, CRM stage...), AND/OR groups, live count, funnel stage, lookback,
  refresh; push to Meta (event on entry -> Website Custom Audience) and Google (GTM event -> GA4 audience); used by popups; no delete
  while in use.
- Scoring Rules: points per signal per channel, catalogue of signals, platform defaults.
- CRM (central on AI Engine via SSO): leads from all channels, stages, notes, settings, users, conversion signals, reply templates;
  Google Ads offline conversions from stages (click ID or hashed email/phone; scheduled CSV fetched by Google Data Manager; log;
  7-day counts; setup checklist auto-ticking); ad source per lead (campaign, ad group, ad, keyword, match type, network) + filters;
  ad source backfill.
- Analytics: date window; users, sessions, conversions, CR; device, source/medium; conversions by type (form/call/WA);
  top pages with views + scroll depth; events breakdown; audience reports; saved reports (read-only SQL).
- Live Content: Live Audio (share links, record voice testimonials with prompts, custom fields, transcripts original/English/Hindi,
  rating, approve/reject, order). Live Reviews (written reviews via link, custom fields, moderation).
- Video Sessions: video call with guest link, linked to lead, status/usage, buy video credits.
- SEO off page: QnA Finder (search Quora/Reddit etc. by keyword after date, own search API keys, save by topic); Instagram search.
- SEO on page: URLs & titles table; redirects (hits, last hit); robots.txt (preset); sitemap XML (pages + blogs); image optimisation.
- Shop: products (price, compare-at INR, image, SKU, stock, descriptions, status); orders (product, buyer, amount, status, payment ID).
- Knowledge Brain: business context (summary, location, tags; AI-generated); knowledge brief; add from files/URLs/text by
  category/use case; AI Vision for scans; Business Interview (private link, 14-day expiry, voice/typing, attachments 10MB,
  12 default questions, language); Extracted Content (sources by category Business Info/Competitor/Market Intel/Q&A, chunks,
  embedding status, approve/edit); Generate Content (FAQ, USP, ad copy, sections, sales story, email; tone/audience/platform/count;
  reuse); Output Library (status); Market Trends (AI research questions, web search 30-120 days, findings -> approve/embed);
  Q&A Generator (topic + location -> real questions from Quora/Reddit).
- AI Page Builder: page + keyword + tone + model + goal -> content for each section; brochure/PDF source with AI Vision.
- AI Setup: connect to AI Engine, status, system checks, credit balance, buy credits via Razorpay, pending activation.
- Integrations: GTM container ID + export GTM container JSON; Meta Pixel + CAPI token + test code, action->event mapping,
  7-day health incl. dedup, exclusions (test pages/phones); Facebook Lead Forms webhook + form mapping + fetch missed leads;
  Google Ads offline conversions; CMS Personal Assistant (MCP: URL, OAuth client id/secret, per-group Off/Read/Write, rotate,
  require admin sign-in approval).
- Scraper: scrape URLs, download history.
- Administration: Updates (DB migrations), Build Release (master), Apply Updates (clients); Layout Installer & Menu Installer (ZIP
  packs); Users (role, status, CRM access, assistant access, social level + approve switch); Modules (licensed add-ons per domain
  with end date, signed by AI Engine, 2x/day check, 14-day grace); Affiliates paid module (partners, one-time password links,
  referrals, deal value, owner change with reason, import, commissions approve/reject, payouts with 4-eyes mark-paid, rules/terms
  versioned drafts->publish, partner portal /public/partner/login.php + register with WhatsApp/email OTP, Referred by card in CRM).
- Docs: Feature Map, MCP Coverage, Retargeting Guide, CRM Review, WhatsApp Business Guide, Layout Design Rules; AI Skills & Plugins
  (Layout Plugin Designer, Menu Plugin Designer kits).

## Currency/locale hints
Prices in INR (₹), Razorpay, transcripts in Hindi -> built for the Indian market first.
