import { adminRoute } from "@/lib/api";
import { getSetting } from "@/lib/settings";
import { decrypt } from "@/lib/crypto";
import { sendMetaEvent } from "@/lib/integrations/adPlatforms";

/** Sends a test Lead event to Meta's Test Events screen. */
export const POST = adminRoute("integrations", async (ctx) => {
  const m = await getSetting(ctx.site.id, "integrations.meta");
  const r = await sendMetaEvent({
    pixelId: m.pixelId,
    token: m.capiTokenEnc ? decrypt(m.capiTokenEnc) : "",
    testEventCode: m.testEventCode || "TEST",
    eventName: "Lead",
    eventId: `test_${Date.now()}`,
    eventTime: Math.floor(Date.now() / 1000),
    actionSource: "website",
    eventSourceUrl: `https://${ctx.site.domain}/`,
    userData: { client_user_agent: "GrowthSuite test" },
  });
  return {
    ok: true,
    message: (r as { mock?: boolean }).mock
      ? "Mock mode: event recorded locally (add a pixel and token to send for real)."
      : "Test event sent. Check Events Manager → Test events.",
    response: r,
  };
});
