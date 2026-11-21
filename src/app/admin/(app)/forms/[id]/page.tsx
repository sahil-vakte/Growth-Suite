import { forms } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/current";
import { siteRow } from "@/lib/admin/rows";
import FormBuilder from "@/components/admin/FormBuilder";

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin("forms");
  const f = await siteRow(forms, (await params).id, ctx.site.id, "Form");
  return (
    <FormBuilder
      id={f.id}
      name={f.name}
      status={f.status}
      initialFields={f.fields as never}
      initialSettings={f.settings as never}
    />
  );
}
