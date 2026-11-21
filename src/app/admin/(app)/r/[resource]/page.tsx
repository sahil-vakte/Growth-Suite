import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current";
import { canAccess } from "@/lib/auth/permissions";
import { resourceByKey } from "@/lib/admin/resources";
import { resourceActions } from "@/lib/admin/actions";
import ResourceManager, { type ClientResource } from "@/components/admin/ResourceManager";

export default async function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const r = resourceByKey(resource);
  if (!r) notFound();
  const ctx = await requireAdmin();
  if (!canAccess(ctx.member, r.feature)) return <div className="alert error">You do not have access to {r.label}.</div>;
  const relations: ClientResource["relations"] = {};
  for (const f of r.fields) if (f.type === "relation" && f.relation) { const rel = resourceByKey(f.relation); if (rel) relations[f.key] = { key: rel.key, titleField: rel.titleField }; }
  const client: ClientResource = { key: r.key, label: r.label, singular: r.singular, titleField: r.titleField, fields: r.fields, readOnly: r.readOnly, noCreate: r.noCreate, noDelete: r.noDelete, description: r.description, relations, actions: resourceActions[r.key], currency: ctx.site.currency };
  return <ResourceManager res={client} />;
}
