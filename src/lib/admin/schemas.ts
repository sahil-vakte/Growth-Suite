import { z } from "zod";
import { GROUPS } from "../mcp/tools";

export const memberSchema = z.object({ role: z.enum(["admin", "editor", "sales"]), crmAccess: z.enum(["inherit", "allow", "deny"]), mcpAccess: z.boolean(), socialLevel: z.enum(["executive", "publisher", "none"]), socialApprove: z.boolean() });
export const permsSchema = z.record(z.enum(GROUPS), z.enum(["off", "read", "write"]));
export const siteSchema = z.object({ name: z.string().min(1).max(120), domain: z.string().min(3).max(253).regex(/^[a-z0-9.-]+$/i, "Domain only, e.g. client.co.uk"), aliases: z.array(z.string().max(253)).max(20).default([]), timezone: z.string().max(60).default("Europe/London"), currency: z.string().length(3).default("GBP"), locale: z.string().max(10).default("en-GB"), plan: z.string().max(40).default("starter"), status: z.enum(["active", "suspended"]).default("active"), region: z.string().max(10).default("eu") });
