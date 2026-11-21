# Audit notes 2 — structure, stack, data (read-only fetches, 2026-11-21)

## Stack observed
- nginx/1.25.5, PHP (.php endpoints), MySQL (utf8mb4 collation migrations), session cookie auth, server-rendered admin.
- Paths: /public/admin/* (admin), /public/crm/ (legacy local CRM), /public/api/crm/ (signed CRM API), /public/partner/* (affiliate portal),
  /uploads/documents, public pages at /<slug>, /blog, /blog/category/<slug>.
- Central AI Engine: aiengine.lipsindia.com (CRM UI at /crm, SSO via crm_sso.php?target=..., WhatsApp sender + webhook, scheduler
  calls sites every few minutes, credits, module licence signer, release server). Platform Meta app in LipsIndia Business Manager.
- 244 DB migrations; dozens of "plugin_*_v1" = installable section layout packs (zip: manifest.json, layout.php, install.sql).
- This install is small: 7 pages, 2 admin users, 2 forms, 1 submission, 4 scoring rules -> demo/test site (mortgage niche content).

## Tables implied by migrations (non-plugin)
form_spam_guard, wa_chat_widget, affiliate(+registration), module_license, wa_bot(+parts, signals), social_posts/schedule/notify/
media/access, chat_conversation_lead, knowledge_brief, business_interview, section_audience_rule, brand_guidelines,
call_cta_sources, wa_campaigns, blog_ai_v2_tables, blog_seo_fields, google_ads_offline_conversions, mcp_user_access,
lead_ad_source, content_revisions, saved_reports, whatsapp_automations, whatsapp_variables_templates, whatsapp_foundation,
crm_conversions_google, segment_member_state, segment_members_per_lead, segment_destinations, audience_segments,
generic_lead_stages_seed, facebook_lead_enrichment_retry, google_ads_website_conversions, meta_website_events,
lead_attribution_snapshot, meta_capi_crm_signals, blog_topic_pool, leads_score_cache, backfill_lead_visitor_ids,
leads_source_wa_verify, forms_lookup_field, calculated_forms, video_uploads, whatsapp_message_tracking, video_sessions,
meta_conversion_api, floating_cta, live_text_reviews, layout_plugins_kind, ai_layout_generation_revisions, blog_research_snippets,
pages_schema_fields, chatbot tables (intents, training), header_templates, facebook_ads_leads, menu templates, password_resets,
global_footer, live_audio (dynamic fields, multilingual transcripts, rating, order), page_section_planner,
common_content_templates, popup_campaigns, whatsapp_multi_numbers, analytics_visitor_identity, crm_user_access,
blog_posts(+author, global style, wizard state), whatsapp_call_settings, cms_releases(+migrations_json), crm_call_recordings,
appointment_scheduler(+service templates, booking form link), ai_layout_generations, email_forwarding_verifications,
products_and_orders, crm_lead_management.

## Field-level captures
- users: email, full_name, role(admin|editor), status(active|disabled), crm_access(inherit|allow|deny), mcp_access(deny|allow),
  social_access(executive|publisher|none), social_approve(bool), password; table shows Last Login.
- appointments: timezone, slot_interval_minutes, lead_time_minutes, booking_window_days; service(name, duration_minutes,
  buffer_minutes, price, is_active); booking_form_id; staff(name,email,phone,google_calendar_id, weekly hours); bookings(when UTC,
  service, staff, customer, status).
- chatbot widget: name, bot_name, model_key, purpose, trigger_mode, position, theme_color, greeting_text, custom_instructions,
  launcher_label, kb_use_cases, kb_categories, page_scope_ids[], url rules(op,value), avatar, cta_whatsapp/phone/url/form_id,
  launcher images, look_* (header bg/text, body bg, bubbles, chip, launcher bg, status dot/text, footer text, panel width,
  radius, font size/family, spacing, launcher style), show_sources, collect_name/email/phone, is_active.
- audiences: name, tier(funnel), match_logic, lookback_days, refresh_minutes, dest_meta, dest_google, google_send_name,
  dest_cm (customer match), is_active; condition groups.
- scoring rules: source_channel, signal_key, points, status; platform defaults.
- click to call: call_number, default_cc, cta(name, phone, active), source rules.
- floating CTA: enabled, position, whatsapp(on, template, bg, icon), call(id, show number, bg, icon), form(id, bg, icon),
  wa card(enabled, title, status, greeting, button, color, side, open, delay).
- whatsapp: channel(name, cc, local, default, active), templates(name, sort, body); click log (page/source, time).
- WA bot: enabled; rule(name, match_type, keywords, reply_text, signal mode/meta event/google event/value/currency,
  then_action, is_active); greeting, fallback, away, handoff_reply, handoff_words, media_reply; hours on/start/end/days/tz;
  takeover_hours, session_hours, daily_cap; test box; activity log.
- products: name, slug, short_description, description, price_inr, compare_price_inr, image_url, sku, stock_qty, status, sort_order.
- redirects: old_url, new_url, status_code (+hits, last hit).
- GTM: gtm_id. Google Ads offline: mode(off|yagops|file), file_user, file_password, timezone; log; checklist.
- header: template, enabled, theme, font set, logo label/href/url/alt/w/h, announcement, email, phone, whatsapp, right text,
  cta1/cta2 (label, href, newtab).
- menu: home_page_id, items(label, href, icon, parent, position), brand(label, href, logo), blog(enabled,label,page,position),
  cta(label, target), mega panels, design & appearance.
- themes: name, palette tokens; font sets font1..font12, google_import, font_file.
- analytics: days/from/to; conversion by source; conversion performance; top pages(views, avg scroll); event breakdown.
- forms list: ID, name, status, fields, updated, embed; submissions(form, date, page URL).
- knowledge sources: category, type, title/URL, chunks, status, added; use_for[].
- video sessions: session, guest link, status.
