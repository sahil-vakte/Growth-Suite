import { withApiLog } from "@/lib/apiLogging";
import { adminRoute } from "@/lib/api";
import { getSetting } from "@/lib/settings";

/** Ready-made Google Tag Manager container (import via Admin → Import container) with triggers for every conversion event. */
export const GET = withApiLog(
  "/api/admin/integrations/gtm-export",
  "GET",
  adminRoute("integrations", async (ctx) => {
    const ga = await getSetting(ctx.site.id, "integrations.ga4");
    const events = [
      "cms_form_submit",
      "cms_whatsapp_click",
      "cms_call_click",
      "cms_popup_click",
      "cms_booking_made",
      "cms_purchase",
      "cms_call_source_click",
    ];
    const triggers = events.map((e, i) => ({
      accountId: "0",
      containerId: "0",
      triggerId: String(10 + i),
      name: `CE - ${e}`,
      type: "CUSTOM_EVENT",
      customEventFilter: [
        {
          type: "EQUALS",
          parameter: [
            { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
            { type: "TEMPLATE", key: "arg1", value: e },
          ],
        },
      ],
    }));
    const tags = [
      {
        accountId: "0",
        containerId: "0",
        tagId: "1",
        name: "GA4 - Config",
        type: "googtag",
        parameter: [{ type: "TEMPLATE", key: "tagId", value: ga.measurementId || "G-XXXXXXX" }],
        firingTriggerId: ["2147479553"],
      },
      ...events.map((e, i) => ({
        accountId: "0",
        containerId: "0",
        tagId: String(100 + i),
        name: `GA4 - ${e.replace("cms_", "")}`,
        type: "gaawe",
        parameter: [
          { type: "TEMPLATE", key: "eventName", value: e.replace("cms_", "") },
          {
            type: "TEMPLATE",
            key: "measurementIdOverride",
            value: ga.measurementId || "G-XXXXXXX",
          },
        ],
        firingTriggerId: [String(10 + i)],
      })),
    ];
    const container = {
      exportFormatVersion: 2,
      exportTime: new Date().toISOString(),
      containerVersion: {
        accountId: "0",
        containerId: "0",
        container: { name: `${ctx.site.name} conversions`, usageContext: ["WEB"] },
        tag: tags,
        trigger: triggers,
      },
    };
    return new Response(JSON.stringify(container, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="gtm-container-${ctx.site.domain}.json"`,
      },
    });
  }),
);
