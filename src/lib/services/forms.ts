/** Public form submission pipeline: validate → spam guard → store → lead → forwarding → events. */
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { forms, submissions, visitors } from "@/db/schema";
import { checkSpam } from "../engines/spamGuard";
import { evaluateFormula } from "../engines/formula";
import { normaliseEmail, normalisePhone } from "../engines/phone";
import { getSetting } from "../settings";
import { hashIp } from "../crypto";
import { addActivity, emitLeadEvent, recomputeScore, upsertLead } from "./leads";
import { enqueue } from "../queue";

export interface FormField {
  key: string;
  label: string;
  type:
    | "text"
    | "email"
    | "tel"
    | "textarea"
    | "number"
    | "select"
    | "radio"
    | "checkbox"
    | "date"
    | "hidden"
    | "calculated"
    | "consent";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  width?: "full" | "half" | "third";
  formula?: string;
  prefix?: string;
  suffix?: string;
  showIf?: { field: string; equals: string };
  maxLength?: number;
}
export interface FormSettings {
  successMessage?: string;
  redirectUrl?: string;
  forwardEmails?: string[];
  webhooks?: string[];
  waOtp?: boolean;
  isTest?: boolean;
  submitLabel?: string;
}

export function fieldVisible(f: FormField, values: Record<string, unknown>) {
  return !f.showIf || String(values[f.showIf.field] ?? "") === f.showIf.equals;
}

export function validateSubmission(
  fields: FormField[],
  raw: Record<string, unknown>,
  defaultCc: string,
): { values: Record<string, unknown>; errors: Record<string, string> } {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "calculated") continue;
    if (!fieldVisible(f, raw)) continue;
    let v = raw[f.key];
    if (typeof v === "string")
      v = v.trim().slice(0, f.maxLength ?? (f.type === "textarea" ? 5000 : 500));
    const empty =
      v === undefined ||
      v === null ||
      v === "" ||
      (Array.isArray(v) && !v.length) ||
      (f.type === "consent" && v !== true && v !== "true" && v !== "on");
    if (empty) {
      if (f.required) errors[f.key] = `${f.label} is required.`;
      continue;
    }
    if (f.type === "email") {
      const e = normaliseEmail(String(v));
      if (!e) {
        errors[f.key] = "Enter a valid email address.";
        continue;
      }
      v = e;
    }
    if (f.type === "tel") {
      const p = normalisePhone(String(v), defaultCc);
      if (!p) {
        errors[f.key] = "Enter a valid phone number.";
        continue;
      }
      v = p;
    }
    if (f.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) {
        errors[f.key] = "Enter a number.";
        continue;
      }
      v = n;
    }
    if (
      (f.type === "select" || f.type === "radio") &&
      f.options?.length &&
      !f.options.includes(String(v))
    ) {
      errors[f.key] = "Choose one of the options.";
      continue;
    }
    if (f.type === "consent") v = true;
    values[f.key] = v;
  }
  for (const f of fields.filter((x) => x.type === "calculated" && x.formula)) {
    try {
      values[f.key] = evaluateFormula(
        f.formula!,
        Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])),
      );
    } catch {
      values[f.key] = null;
    }
  }
  return { values, errors };
}

export const submitSchema = z.object({
  values: z.record(z.unknown()),
  visitorId: z.string().max(64).optional(),
  pageUrl: z.string().max(2000).optional(),
  renderedAt: z.number().optional(),
  hp: z.string().optional(),
  ids: z.record(z.string()).optional(),
});

export async function submitForm(
  siteId: string,
  formId: string,
  body: z.infer<typeof submitSchema>,
  ip: string,
) {
  const [form] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.siteId, siteId)))
    .limit(1);
  if (!form || form.status !== "active")
    return { ok: false as const, status: 404, error: "This form is not available." };
  const settings = form.settings as FormSettings;
  const fields = form.fields as FormField[];
  const { defaultCountryCode } = await getSetting(siteId, "crm.defaults");
  const { values, errors } = validateSubmission(fields, body.values, defaultCountryCode);
  if (Object.keys(errors).length)
    return {
      ok: false as const,
      status: 422,
      error: "Please check the highlighted fields.",
      errors,
    };

  const ipHash = hashIp(ip);
  const phone = Object.entries(values).find(
    ([k]) => fields.find((f) => f.key === k)?.type === "tel",
  )?.[1] as string | undefined;
  const email = Object.entries(values).find(
    ([k]) => fields.find((f) => f.key === k)?.type === "email",
  )?.[1] as string | undefined;
  const hourAgo = new Date(Date.now() - 3600_000);
  const count = async (cond: ReturnType<typeof sql>) =>
    Number(
      (
        (
          await db.execute(
            sql`select count(*)::int as c from submissions where site_id = ${siteId} and created_at >= ${hourAgo.toISOString()} and ${cond}`,
          )
        ).rows[0] as { c: number }
      ).c,
    );
  const recentCounts = {
    ip: await count(sql`ip_hash = ${ipHash}`),
    phone: phone ? await count(sql`data->>'__phone' = ${phone}`) : 0,
    email: email ? await count(sql`data->>'__email' = ${email}`) : 0,
  };
  const verdict = checkSpam(
    { honeypot: body.hp, renderedAt: body.renderedAt, values, recentCounts },
    await getSetting(siteId, "forms.spamGuard"),
  );
  const data = {
    ...values,
    ...(phone ? { __phone: phone } : {}),
    ...(email ? { __email: email } : {}),
  };
  const success = {
    ok: true as const,
    message: settings.successMessage || "Thank you — we will be in touch shortly.",
    redirectUrl: settings.redirectUrl || null,
  };

  if (verdict.spam) {
    await db.insert(submissions).values({
      siteId,
      formId,
      data,
      pageUrl: body.pageUrl,
      visitorId: body.visitorId,
      status: "spam",
      spamReason: verdict.reason,
      ipHash,
    });
    return success; // the sender sees the normal thank-you message
  }

  let attribution: Record<string, unknown> = {};
  if (body.visitorId) {
    const [v] = await db
      .select()
      .from(visitors)
      .where(and(eq(visitors.id, body.visitorId), eq(visitors.siteId, siteId)))
      .limit(1);
    if (v) attribution = { ...(v.ids as object), ...(v.firstTouch as object) };
  }
  if (body.ids) attribution = { ...body.ids, ...attribution };

  const [sub] = await db
    .insert(submissions)
    .values({ siteId, formId, data, pageUrl: body.pageUrl, visitorId: body.visitorId, ipHash })
    .returning();
  let leadId: string | null = null;
  if ((phone || email) && !settings.isTest) {
    const name = (values.name ??
      values.full_name ??
      [values.first_name, values.last_name].filter(Boolean).join(" ")) as string | undefined;
    const custom = Object.fromEntries(
      Object.entries(values).filter(([k]) => !["name", "full_name", "email", "phone"].includes(k)),
    );
    const consent = Object.fromEntries(
      fields
        .filter((f) => f.type === "consent" && values[f.key])
        .map((f) => [f.key, { given: true, at: new Date().toISOString(), text: f.label }]),
    );
    const { lead } = await upsertLead(siteId, {
      name: name || null,
      email,
      phone,
      source: "website",
      visitorId: body.visitorId,
      attribution,
      customFields: custom,
      consent,
    });
    leadId = lead.id;
    await db.update(submissions).set({ leadId }).where(eq(submissions.id, sub.id));
    if (body.visitorId)
      await db.update(visitors).set({ leadId }).where(eq(visitors.id, body.visitorId));
    await addActivity(siteId, lead.id, "submission", `Submitted "${form.name}"`, {
      formId,
      submissionId: sub.id,
      pageUrl: body.pageUrl,
    });
    await recomputeScore(siteId, lead.id);
    await emitLeadEvent(siteId, lead, { type: "form_submitted", formId, value: formId });
  }
  for (const to of settings.forwardEmails ?? [])
    await enqueue(
      "email.lead_forward",
      { to, formName: form.name, values, pageUrl: body.pageUrl ?? "" },
      { siteId },
    );
  for (const url of settings.webhooks ?? [])
    await enqueue(
      "webhook.post",
      {
        url,
        body: {
          form: form.name,
          formId,
          submissionId: sub.id,
          leadId,
          values,
          pageUrl: body.pageUrl,
        },
      },
      { siteId },
    );
  return { ...success, submissionId: sub.id, leadId };
}

export async function recentSubmissionCount(siteId: string, since: Date) {
  const [r] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(submissions)
    .where(and(eq(submissions.siteId, siteId), gte(submissions.createdAt, since)));
  return r.c;
}
