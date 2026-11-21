/** WhatsApp Cloud API (Meta). Docs: https://developers.facebook.com/docs/whatsapp/cloud-api */
import { env, isConfigured } from "../env";
import { callJson, recordMock } from "./http";

const graph = (path: string) => `https://graph.facebook.com/${env.whatsapp.graphVersion}/${path}`;
const auth = () => ({ Authorization: `Bearer ${env.whatsapp.token}`, "Content-Type": "application/json" });

export interface TemplateSend { phoneNumberId: string; to: string; template: string; language: string; bodyParams: string[]; headerParams?: string[] }

export async function sendTemplate(m: TemplateSend): Promise<{ id: string; mock?: boolean }> {
  const components = [
    ...(m.headerParams?.length ? [{ type: "header", parameters: m.headerParams.map((t) => ({ type: "text", text: t })) }] : []),
    ...(m.bodyParams.length ? [{ type: "body", parameters: m.bodyParams.map((t) => ({ type: "text", text: t })) }] : []),
  ];
  const body = { messaging_product: "whatsapp", to: m.to.replace(/\D/g, ""), type: "template", template: { name: m.template, language: { code: m.language }, components } };
  if (!isConfigured.whatsapp() || !m.phoneNumberId) return recordMock("whatsapp", "send_template", body);
  const r = await callJson<{ messages: { id: string }[] }>(graph(`${m.phoneNumberId}/messages`), { method: "POST", headers: auth(), body: JSON.stringify(body) });
  return { id: r.messages[0].id };
}

export async function sendText(phoneNumberId: string, to: string, text: string): Promise<{ id: string; mock?: boolean }> {
  const body = { messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "text", text: { body: text, preview_url: true } };
  if (!isConfigured.whatsapp() || !phoneNumberId) return recordMock("whatsapp", "send_text", body);
  const r = await callJson<{ messages: { id: string }[] }>(graph(`${phoneNumberId}/messages`), { method: "POST", headers: auth(), body: JSON.stringify(body) });
  return { id: r.messages[0].id };
}

export async function listNumbers(wabaId: string): Promise<{ id: string; display_phone_number: string; verified_name: string; quality_rating?: string }[]> {
  if (!isConfigured.whatsapp()) return [{ id: "mock-phone-number-id", display_phone_number: "+44 7700 900000", verified_name: "Demo Business", quality_rating: "GREEN" }];
  const r = await callJson<{ data: { id: string; display_phone_number: string; verified_name: string; quality_rating?: string }[] }>(graph(`${wabaId}/phone_numbers`), { headers: auth() });
  return r.data;
}

export async function submitTemplate(wabaId: string, tpl: { name: string; language: string; category: string; components: unknown }): Promise<{ id: string; status: string }> {
  if (!isConfigured.whatsapp()) { recordMock("whatsapp", "submit_template", tpl); return { id: `mock_tpl_${Date.now()}`, status: "APPROVED" }; }
  return callJson(graph(`${wabaId}/message_templates`), { method: "POST", headers: auth(), body: JSON.stringify(tpl) });
}

/** Rule checks Meta applies before review (subset). */
export function templateProblems(t: { name: string; components: { body?: string; header?: string; footer?: string; buttons?: unknown[] } }): string[] {
  const p: string[] = [];
  if (!/^[a-z0-9_]{1,512}$/.test(t.name)) p.push("Name must use lowercase letters, numbers and underscores only.");
  const body = t.components.body ?? "";
  if (!body.trim()) p.push("Body text is required.");
  if (body.length > 1024) p.push("Body must be 1,024 characters or fewer.");
  if (/^\s*\{\{\d+\}\}|\{\{\d+\}\}\s*$/.test(body)) p.push("Body cannot start or end with a variable.");
  const nums = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  if (nums.some((n, i) => n !== i + 1)) p.push("Variables must be numbered {{1}}, {{2}}… in order.");
  if ((t.components.footer ?? "").length > 60) p.push("Footer must be 60 characters or fewer.");
  if ((t.components.header ?? "").length > 60) p.push("Text header must be 60 characters or fewer.");
  if ((t.components.buttons ?? []).length > 10) p.push("At most 10 buttons.");
  return p;
}
