import { z } from "zod";
import { adminRoute, readJson } from "@/lib/api";
import { HttpError } from "@/lib/auth/current";
import { listNumbers } from "@/lib/integrations/whatsapp";
import { setSetting } from "@/lib/settings";
import { env } from "@/lib/env";

/** Step 1: fetch the numbers on a WhatsApp Business Account. Step 2: save the chosen number (verified live with Meta). */
export const POST = adminRoute("whatsapp_business", async (ctx, req) => {
  if (ctx.member.role !== "admin" && !ctx.member.isPlatformAdmin)
    throw new HttpError(403, "Only admins can connect WhatsApp.");
  const b = z
    .object({
      wabaId: z.string().regex(/^\d{5,25}$/, "Enter the numeric WhatsApp Business Account ID"),
      phoneNumberId: z.string().optional(),
    })
    .parse(await readJson(req));
  let numbers;
  try {
    numbers = await listNumbers(b.wabaId);
  } catch (e) {
    await setSetting(ctx.site.id, "whatsapp.connection", { wabaId: b.wabaId, status: "error" });
    throw new HttpError(
      502,
      `Meta refused: ${e instanceof Error ? e.message : e}. Check the account is shared with our partner business ID ${env.whatsapp.partnerBusinessId || "(set META_PARTNER_BUSINESS_ID)"}.`,
    );
  }
  if (!b.phoneNumberId) return { numbers, partnerBusinessId: env.whatsapp.partnerBusinessId };
  const n = numbers.find((x) => x.id === b.phoneNumberId);
  if (!n)
    throw new HttpError(
      422,
      "That Phone Number ID is not on this account. Pick one from the list (it is not the phone number itself).",
    );
  await setSetting(ctx.site.id, "whatsapp.connection", {
    wabaId: b.wabaId,
    phoneNumberId: n.id,
    displayNumber: n.display_phone_number,
    status: "connected",
    quality: n.quality_rating ?? "",
  });
  return { ok: true, message: `Connected — Meta confirmed ${n.display_phone_number}.` };
});
