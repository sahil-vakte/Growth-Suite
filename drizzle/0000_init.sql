CREATE TABLE "affiliate_terms" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"version" integer NOT NULL,
	"rules" jsonb NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"delta_minor" integer NOT NULL,
	"reason" text NOT NULL,
	"provider" text,
	"balance_after" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_layout_generations" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"prompt" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"output" jsonb,
	"review" text,
	"versions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_outputs" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text,
	"name" text NOT NULL,
	"page_url" text,
	"source" text,
	"medium" text,
	"device" text,
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"client_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"require_admin_approval" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_clients_clientId_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "appointment_services" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"price_minor" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"html" text NOT NULL,
	"excerpt" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"category_id" text,
	"is_pillar" boolean DEFAULT false NOT NULL,
	"focus_keyword" text,
	"meta_description" text,
	"faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_ids" text[] DEFAULT '{}' NOT NULL,
	"author_name" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"service_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"lead_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_interviews" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"language" text DEFAULT 'en-GB' NOT NULL,
	"questions" jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_interviews_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "call_ctas" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source_rules" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_automation_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"when" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"widget_id" text NOT NULL,
	"visitor_id" text,
	"lead_id" text,
	"intent" text,
	"score" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"contact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"page_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_intent_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"points" integer DEFAULT 10 NOT NULL,
	"phrases" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_training_items" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"embedded" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_widgets" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "click_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"kind" text NOT NULL,
	"cta_id" text,
	"page_url" text,
	"source" text,
	"visitor_id" text,
	"ref_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"referral_id" text NOT NULL,
	"partner_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"available_at" timestamp with time zone NOT NULL,
	"payout_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commissions_referralId_unique" UNIQUE("referral_id")
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"operation" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversion_events" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"signal_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"platform" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"payload" jsonb NOT NULL,
	"response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversion_signals" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"trigger" text NOT NULL,
	"trigger_value" text,
	"platform" text NOT NULL,
	"event_name" text NOT NULL,
	"value_minor" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "font_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"slots" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"fields" jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_error" text,
	"idempotency" text,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_idempotency_unique" UNIQUE("idempotency")
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"source_id" text,
	"text" text NOT NULL,
	"use_for" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"embedding" jsonb,
	"created_by" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"category" text DEFAULT 'business_info' NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "layouts" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'section' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"default_content" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source" text DEFAULT 'builtin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"type" text NOT NULL,
	"body" text,
	"meta" jsonb,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"phone_key" text,
	"source" text DEFAULT 'website' NOT NULL,
	"stage_id" text,
	"owner_id" text,
	"score" integer DEFAULT 0 NOT NULL,
	"visitor_id" text,
	"attribution" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ad_source" jsonb,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"consent" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"wa_verified" boolean DEFAULT false NOT NULL,
	"opted_out" boolean DEFAULT false NOT NULL,
	"last_inbound_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"kind" text DEFAULT 'image' NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"alt" text,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"crm_access" text DEFAULT 'inherit' NOT NULL,
	"mcp_access" boolean DEFAULT false NOT NULL,
	"social_level" text DEFAULT 'executive' NOT NULL,
	"social_approve" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"label" text NOT NULL,
	"href" text NOT NULL,
	"icon" text,
	"parent_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"page_id" text
);
--> statement-breakpoint
CREATE TABLE "module_licenses" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"module_key" text NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"statement" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"number" text NOT NULL,
	"items" jsonb NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text,
	"buyer_phone" text,
	"total_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"provider_ref" text,
	"payment_id" text,
	"lead_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_home" boolean DEFAULT false NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"schema_json" jsonb,
	"theme_id" text,
	"font_set_id" text,
	"last_edited_by" text,
	"last_edited_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"password_hash" text,
	"code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"partner_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"paid_by" text,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "popups" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"layout" text DEFAULT 'center' NOT NULL,
	"content" jsonb NOT NULL,
	"design" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"targeting" jsonb DEFAULT '{"match":"all","conditions":[]}'::jsonb NOT NULL,
	"frequency" text DEFAULT 'session' NOT NULL,
	"delay_sec" integer DEFAULT 3 NOT NULL,
	"segment_id" text,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_description" text,
	"description" text,
	"price_minor" integer NOT NULL,
	"compare_at_minor" integer,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"image_url" text,
	"sku" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"from_path" text NOT NULL,
	"to_url" text NOT NULL,
	"code" integer DEFAULT 301 NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"partner_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"deal_value_minor" integer,
	"terms_version" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reply_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"channel" text DEFAULT 'crm' NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_results" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"tool" text NOT NULL,
	"topic" text NOT NULL,
	"query" text NOT NULL,
	"results" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"kind" text NOT NULL,
	"link_id" text,
	"name" text NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rating" integer,
	"text" text,
	"audio_url" text,
	"transcripts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"channel" text NOT NULL,
	"signal_key" text NOT NULL,
	"points" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"layout_key" text NOT NULL,
	"content" jsonb NOT NULL,
	"style" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"page_id" text NOT NULL,
	"position" integer NOT NULL,
	"layout_key" text NOT NULL,
	"name" text,
	"content" jsonb NOT NULL,
	"style" jsonb,
	"visible" boolean DEFAULT true NOT NULL,
	"audience_rule" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment_members" (
	"id" text PRIMARY KEY NOT NULL,
	"segment_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"lead_id" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"tier" text DEFAULT 'warm' NOT NULL,
	"match_logic" text DEFAULT 'all' NOT NULL,
	"groups" jsonb NOT NULL,
	"lookback_days" integer DEFAULT 30 NOT NULL,
	"refresh_minutes" integer DEFAULT 60 NOT NULL,
	"destinations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"last_built_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"kind" text NOT NULL,
	"token" text NOT NULL,
	"title" text NOT NULL,
	"prompts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"locale" text DEFAULT 'en-GB' NOT NULL,
	"plan" text DEFAULT 'starter' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"region" text DEFAULT 'eu' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"page_id" text NOT NULL,
	"page_name" text,
	"instagram_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"verify_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_pageId_unique" UNIQUE("page_id")
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"account_id" text NOT NULL,
	"caption" text NOT NULL,
	"media_ids" text[] DEFAULT '{}' NOT NULL,
	"platforms" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"requested_at" timestamp with time zone,
	"author_id" text NOT NULL,
	"approver_id" text,
	"return_note" text,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"google_calendar_id" text,
	"weekly_hours" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"form_id" text NOT NULL,
	"lead_id" text,
	"data" jsonb NOT NULL,
	"page_url" text,
	"visitor_id" text,
	"status" text DEFAULT 'accepted' NOT NULL,
	"spam_reason" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"palette" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "video_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"title" text NOT NULL,
	"guest_token" text NOT NULL,
	"lead_id" text,
	"room_url" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_sessions_guestToken_unique" UNIQUE("guest_token")
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"sessions" integer DEFAULT 1 NOT NULL,
	"first_touch" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lead_id" text
);
--> statement-breakpoint
CREATE TABLE "wa_automation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"automation_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wa_automations" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"trigger" text NOT NULL,
	"trigger_value" text,
	"template_id" text NOT NULL,
	"delay_minutes" integer DEFAULT 0 NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quiet_hours" jsonb,
	"skip_if_replied" boolean DEFAULT true NOT NULL,
	"daily_cap" integer DEFAULT 500 NOT NULL,
	"once_per_person" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_bot_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"match_type" text DEFAULT 'contains' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"reply_text" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"then_action" text DEFAULT 'none' NOT NULL,
	"signal" jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"template_id" text NOT NULL,
	"filters" jsonb NOT NULL,
	"speed_per_minute" integer DEFAULT 20 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"lead_id" text,
	"phone" text NOT NULL,
	"direction" text NOT NULL,
	"kind" text DEFAULT 'template' NOT NULL,
	"body" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_id" text,
	"error" text,
	"campaign_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"language" text DEFAULT 'en_GB' NOT NULL,
	"category" text DEFAULT 'MARKETING' NOT NULL,
	"components" jsonb NOT NULL,
	"variable_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"meta_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_ctas" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"number_id" text NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_numbers" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"country_code" text DEFAULT '44' NOT NULL,
	"number" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "affiliate_terms_site_id_version_index" ON "affiliate_terms" USING btree ("site_id","version");--> statement-breakpoint
CREATE INDEX "ai_credit_ledger_site_id_created_at_index" ON "ai_credit_ledger" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_site_id_created_at_index" ON "analytics_events" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_site_id_name_created_at_index" ON "analytics_events" USING btree ("site_id","name","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_visitor_id_index" ON "analytics_events" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_site_id_created_at_index" ON "audit_logs" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_categories_site_id_slug_index" ON "blog_categories" USING btree ("site_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_site_id_slug_index" ON "blog_posts" USING btree ("site_id","slug");--> statement-breakpoint
CREATE INDEX "bookings_site_id_staff_id_starts_at_index" ON "bookings" USING btree ("site_id","staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "click_logs_site_id_kind_created_at_index" ON "click_logs" USING btree ("site_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "content_revisions_site_id_entity_entity_id_created_at_index" ON "content_revisions" USING btree ("site_id","entity","entity_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversion_events_signal_id_lead_id_index" ON "conversion_events" USING btree ("signal_id","lead_id");--> statement-breakpoint
CREATE INDEX "jobs_status_run_at_index" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "layouts_site_id_key_index" ON "layouts" USING btree ("site_id","key");--> statement-breakpoint
CREATE INDEX "lead_activities_lead_id_created_at_index" ON "lead_activities" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_site_id_phone_key_index" ON "leads" USING btree ("site_id","phone_key");--> statement-breakpoint
CREATE INDEX "leads_site_id_created_at_index" ON "leads" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_site_id_stage_id_index" ON "leads" USING btree ("site_id","stage_id");--> statement-breakpoint
CREATE INDEX "media_site_id_kind_index" ON "media" USING btree ("site_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_site_id_user_id_index" ON "memberships" USING btree ("site_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "module_licenses_site_id_module_key_index" ON "module_licenses" USING btree ("site_id","module_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_site_id_number_index" ON "orders" USING btree ("site_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_site_id_slug_index" ON "pages" USING btree ("site_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "products_site_id_slug_index" ON "products" USING btree ("site_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "redirects_site_id_from_path_index" ON "redirects" USING btree ("site_id","from_path");--> statement-breakpoint
CREATE INDEX "sections_page_id_position_index" ON "sections" USING btree ("page_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "segment_members_segment_id_visitor_id_index" ON "segment_members" USING btree ("segment_id","visitor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_site_id_key_index" ON "settings" USING btree ("site_id","key");--> statement-breakpoint
CREATE INDEX "submissions_site_id_created_at_index" ON "submissions" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "visitors_site_id_last_seen_index" ON "visitors" USING btree ("site_id","last_seen");--> statement-breakpoint
CREATE INDEX "wa_automation_runs_status_due_at_index" ON "wa_automation_runs" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "wa_messages_site_id_phone_created_at_index" ON "wa_messages" USING btree ("site_id","phone","created_at");