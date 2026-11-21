/** Meta Conversions API and Google Analytics 4 Measurement Protocol (server-side conversions). */
import { env, isConfigured } from "../env";
import { callJson, recordMock } from "./http";

export interface MetaEvent { pixelId: string; token: string; testEventCode?: string; eventName: string; eventId: string; eventTime: number; actionSource: "website" | "system_generated" | "chat"; eventSourceUrl?: string; userData: Record<string, string | undefined>; customData?: Record<string, unknown> }

export async function sendMetaEvent(e: MetaEvent) {
  const body = {
    data: [{ event_name: e.eventName, event_time: e.eventTime, event_id: e.eventId, action_source: e.actionSource, event_source_url: e.eventSourceUrl,
      user_data: Object.fromEntries(Object.entries(e.userData).filter(([, v]) => v)), custom_data: e.customData }],
    ...(e.testEventCode ? { test_event_code: e.testEventCode } : {}),
  };
  if (env.forceMock || !e.pixelId || !e.token) return recordMock("meta_capi", e.eventName, body);
  return callJson(`https://graph.facebook.com/${env.whatsapp.graphVersion}/${e.pixelId}/events?access_token=${encodeURIComponent(e.token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export interface Ga4Event { measurementId: string; apiSecret: string; clientId: string; sessionId?: string; userData?: { sha256_email_address?: string; sha256_phone_number?: string }; name: string; params: Record<string, unknown>; validateOnly?: boolean }

export async function sendGa4Event(e: Ga4Event) {
  const body = { client_id: e.clientId, ...(e.userData ? { user_data: e.userData } : {}), events: [{ name: e.name, params: { ...e.params, ...(e.sessionId ? { session_id: e.sessionId } : {}) } }] };
  if (env.forceMock || !e.measurementId || !e.apiSecret) return recordMock("ga4", e.name, body);
  const base = e.validateOnly ? "https://www.google-analytics.com/debug/mp/collect" : "https://www.google-analytics.com/mp/collect";
  return callJson(`${base}?measurement_id=${e.measurementId}&api_secret=${e.apiSecret}`, { method: "POST", body: JSON.stringify(body) });
}

/** Facebook Lead Ads: fetch a lead by its leadgen id. */
export async function fetchFacebookLead(leadgenId: string, pageToken: string): Promise<{ field_data: { name: string; values: string[] }[]; form_id: string; created_time: string }> {
  if (env.forceMock || !pageToken) {
    recordMock("facebook_leads", "fetch_lead", { leadgenId });
    return { form_id: "mock-form", created_time: new Date().toISOString(), field_data: [{ name: "full_name", values: ["Mock Lead"] }, { name: "phone_number", values: ["+447700900555"] }, { name: "email", values: ["mock.lead@example.com"] }] };
  }
  return callJson(`https://graph.facebook.com/${env.whatsapp.graphVersion}/${leadgenId}?access_token=${encodeURIComponent(pageToken)}`);
}

export const metaConfigured = () => isConfigured.meta();
