import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { forms } from "@/db/schema";
import FormClient from "./FormClient";
import type { FormField, FormSettings } from "@/lib/services/forms";

export default async function FormEmbed({ formId, siteId }: { formId: string; siteId: string }) {
  const [form] = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.siteId, siteId)))
    .limit(1);
  if (!form || form.status !== "active") return null;
  const st = form.settings as FormSettings;
  return (
    <FormClient
      formId={form.id}
      fields={form.fields as FormField[]}
      submitLabel={st.submitLabel || "Send"}
    />
  );
}
