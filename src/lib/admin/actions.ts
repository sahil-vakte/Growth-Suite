import type { RowAction } from "@/components/admin/ResourceManager";

/** Extra buttons on list rows, wired to dedicated endpoints. */
export const resourceActions: Record<string, RowAction[]> = {
  pages: [
    { label: "Builder", kind: "link", href: "/admin/pages/:id" },
    { label: "Duplicate", kind: "post", href: "/api/admin/pages/:id/duplicate" },
  ],
  forms: [{ label: "Build", kind: "link", href: "/admin/forms/:id" }],
  "wa-templates": [
    {
      label: "Check & submit to Meta",
      kind: "post",
      href: "/api/admin/wa-templates/:id/submit",
      showIf: { field: "status", in: ["draft", "rejected"] },
    },
  ],
  "wa-campaigns": [
    {
      label: "Preview audience",
      kind: "post",
      href: "/api/admin/wa-campaigns/:id/action",
      body: { action: "preview" },
    },
    {
      label: "Start",
      kind: "post",
      href: "/api/admin/wa-campaigns/:id/action",
      body: { action: "start" },
      confirm: "Start sending this campaign now?",
      showIf: { field: "status", in: ["draft", "paused"] },
    },
    {
      label: "Pause",
      kind: "post",
      href: "/api/admin/wa-campaigns/:id/action",
      body: { action: "pause" },
      showIf: { field: "status", in: ["running"] },
    },
    {
      label: "Cancel",
      kind: "post",
      href: "/api/admin/wa-campaigns/:id/action",
      body: { action: "cancel" },
      confirm: "Cancel this campaign? Messages already sent stay sent.",
      showIf: { field: "status", in: ["running", "paused", "draft"] },
    },
  ],
  segments: [{ label: "Rebuild now", kind: "post", href: "/api/admin/segments/:id/rebuild" }],
  "knowledge-chunks": [
    {
      label: "Approve",
      kind: "post",
      href: "/api/admin/knowledge/:id/approve",
      showIf: { field: "status", in: ["pending", "rejected"] },
    },
  ],
  "social-accounts": [
    {
      label: "Check verification",
      kind: "post",
      href: "/api/admin/social-accounts/:id/verify",
      showIf: { field: "status", in: ["pending"] },
    },
  ],
  "social-posts": [
    {
      label: "Send for approval",
      kind: "post",
      href: "/api/admin/social-posts/:id/action",
      body: { action: "submit" },
      showIf: { field: "status", in: ["draft", "returned"] },
    },
    {
      label: "Approve",
      kind: "post",
      href: "/api/admin/social-posts/:id/action",
      body: { action: "approve" },
      showIf: { field: "status", in: ["pending_approval"] },
    },
    {
      label: "Return",
      kind: "post",
      href: "/api/admin/social-posts/:id/action",
      body: { action: "return", note: "Please revise" },
      showIf: { field: "status", in: ["pending_approval"] },
    },
    {
      label: "Publish now",
      kind: "post",
      href: "/api/admin/social-posts/:id/action",
      body: { action: "publish_now" },
      confirm: "Publish this post now?",
      showIf: { field: "status", in: ["draft", "returned", "scheduled", "failed"] },
    },
    {
      label: "Schedule",
      kind: "post",
      href: "/api/admin/social-posts/:id/action",
      body: { action: "schedule" },
      showIf: { field: "status", in: ["draft", "returned"] },
    },
    {
      label: "Cancel",
      kind: "post",
      href: "/api/admin/social-posts/:id/action",
      body: { action: "cancel" },
      showIf: { field: "status", in: ["scheduled"] },
    },
  ],
  submissions: [
    {
      label: "Restore as lead",
      kind: "post",
      href: "/api/admin/submissions/:id/restore",
      confirm: "This entry was held as spam. Create a lead from it?",
      showIf: { field: "status", in: ["spam"] },
    },
  ],
  "affiliate-terms": [
    {
      label: "Publish",
      kind: "post",
      href: "/api/admin/affiliate-terms/:id/publish",
      confirm: "Publish these terms? They cannot be changed afterwards.",
      showIf: { field: "publishedAt", in: [null] },
    },
  ],
  payouts: [
    {
      label: "Approve",
      kind: "post",
      href: "/api/admin/payouts/:id/action",
      body: { action: "approve" },
      showIf: { field: "status", in: ["draft"] },
    },
    {
      label: "Mark paid",
      kind: "post",
      href: "/api/admin/payouts/:id/action",
      body: { action: "mark_paid" },
      showIf: { field: "status", in: ["approved"] },
    },
  ],
  "share-links": [{ label: "Open link", kind: "link", href: "/admin/share-links/:id" }],
  "video-sessions": [
    { label: "Start room", kind: "post", href: "/api/admin/video-sessions/:id/start" },
  ],
  "chat-training": [{ label: "Embed all", kind: "post", href: "/api/admin/chat-training/embed" }],
};
