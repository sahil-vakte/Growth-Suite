/** Social posting permissions and approval workflow. */
export type SocialLevel = "executive" | "publisher" | "none";
export interface Actor { id: string; isAdmin: boolean; level: SocialLevel; canApprove: boolean }
export type PostStatus = "draft" | "pending_approval" | "returned" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
export type PostAction = "save_draft" | "submit" | "approve" | "return" | "schedule" | "publish_now" | "cancel" | "retry" | "withdraw";

export const MAX_LATE_HOURS = 6;

export function can(actor: Actor, action: PostAction, post: { authorId: string; status: PostStatus }, rules: { publishersNeedApproval: boolean }): boolean {
  if (actor.level === "none" && !actor.isAdmin) return false;
  if (actor.isAdmin) return true;
  const own = post.authorId === actor.id;
  switch (action) {
    case "save_draft": case "submit": return own && ["draft", "returned"].includes(post.status);
    case "withdraw": return own && post.status === "pending_approval";
    case "approve": case "return": return actor.level === "publisher" && actor.canApprove && !own && post.status === "pending_approval";
    case "schedule": case "publish_now":
      return actor.level === "publisher" && !rules.publishersNeedApproval && ["draft", "returned", "scheduled", "failed", "cancelled"].includes(post.status);
    case "cancel": return actor.level === "publisher" && post.status === "scheduled";
    case "retry": return actor.level === "publisher" && ["failed", "cancelled"].includes(post.status);
  }
}

export function nextStatus(action: PostAction, scheduledAt: Date | null, now = new Date()): PostStatus {
  switch (action) {
    case "save_draft": return "draft";
    case "submit": return "pending_approval";
    case "withdraw": return "draft";
    case "return": return "returned";
    case "cancel": return "cancelled";
    case "approve": case "schedule": case "retry": return scheduledAt && scheduledAt > now ? "scheduled" : "publishing";
    case "publish_now": return "publishing";
  }
}

export function tooLate(scheduledAt: Date, now = new Date()): boolean {
  return now.getTime() - scheduledAt.getTime() > MAX_LATE_HOURS * 3600_000;
}

/** Instagram caption checks. */
export function captionWarnings(caption: string, platforms: string[]): string[] {
  const w: string[] = [];
  if (platforms.includes("instagram")) {
    if (caption.length > 2200) w.push("Instagram captions are limited to 2,200 characters.");
    if ((caption.match(/#\w+/g) ?? []).length > 30) w.push("Instagram allows at most 30 hashtags.");
    if (/https?:\/\//.test(caption)) w.push("Links in Instagram captions are not clickable.");
  }
  return w;
}

export function addUtm(caption: string, ownDomain: string, platform: string, campaign: string): string {
  return caption.replace(/https?:\/\/[^\s]+/g, (url) => {
    try {
      const u = new URL(url);
      if (u.hostname.replace(/^www\./, "") !== ownDomain.replace(/^www\./, "")) return url;
      u.searchParams.set("utm_source", platform); u.searchParams.set("utm_medium", "social"); u.searchParams.set("utm_campaign", campaign);
      return u.toString();
    } catch { return url; }
  });
}
