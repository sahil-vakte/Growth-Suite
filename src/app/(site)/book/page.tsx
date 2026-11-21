import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { appointmentServices, staff } from "@/db/schema";
import { currentSite } from "@/lib/site/pageData";
import SiteShell from "@/components/site/SiteShell";
import Booking from "@/components/site/Booking";

export const dynamic = "force-dynamic";
export default async function BookPage() {
  const site = await currentSite(); if (!site) notFound();
  const services = await db.select().from(appointmentServices).where(and(eq(appointmentServices.siteId, site.id), eq(appointmentServices.active, true)));
  const team = await db.select({ id: staff.id, name: staff.name }).from(staff).where(and(eq(staff.siteId, site.id), eq(staff.active, true)));
  return <SiteShell site={site} path="/book"><section className="s-sec"><div className="s-wrap s-narrow"><h1>Book an appointment</h1><Booking services={services.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes, price: s.priceMinor ? new Intl.NumberFormat("en-GB", { style: "currency", currency: s.currency }).format(s.priceMinor / 100) : "" }))} staff={team} /></div></section></SiteShell>;
}
