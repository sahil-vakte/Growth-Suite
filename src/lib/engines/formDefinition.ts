/** Validates form field definitions saved from the builder (unique keys, known types, options, formulas, conditions). */
import { evaluateFormula } from "./formula";

export const FIELD_TYPES = ["text", "email", "tel", "textarea", "number", "select", "radio", "checkbox", "date", "hidden", "calculated", "consent"] as const;
export interface FieldDef { key: string; label: string; type: string; required?: boolean; options?: string[]; formula?: string; showIf?: { field: string; equals: string } | null; width?: string }

export function formDefinitionProblems(fields: unknown): string[] {
  if (!Array.isArray(fields)) return ["Fields must be a list."];
  const p: string[] = []; const keys = new Set<string>();
  if (!fields.length) p.push("Add at least one field.");
  if (fields.length > 60) p.push("A form can have at most 60 fields.");
  fields.forEach((raw, i) => {
    const f = raw as FieldDef; const n = `Field ${i + 1}`;
    if (!f || typeof f !== "object") { p.push(`${n} is not valid.`); return; }
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(f.key ?? "")) p.push(`${n}: the key must start with a letter and use lowercase letters, numbers and underscores.`);
    else if (keys.has(f.key)) p.push(`${n}: the key "${f.key}" is used twice.`); else keys.add(f.key);
    if (!f.label?.trim()) p.push(`${n}: add a label.`);
    if (!FIELD_TYPES.includes(f.type as (typeof FIELD_TYPES)[number])) p.push(`${n}: unknown type "${f.type}".`);
    if ((f.type === "select" || f.type === "radio") && (!Array.isArray(f.options) || f.options.filter(Boolean).length < 1)) p.push(`${n}: add at least one option.`);
    if (f.type === "calculated") {
      if (!f.formula?.trim()) p.push(`${n}: add a formula.`);
      else { try { evaluateFormula(f.formula, {}); } catch (e) { p.push(`${n}: formula problem — ${e instanceof Error ? e.message : e}.`); } }
    }
  });
  fields.forEach((raw, i) => { const f = raw as FieldDef; if (f?.showIf?.field && !keys.has(f.showIf.field)) p.push(`Field ${i + 1}: "show only if" refers to a field that does not exist.`); });
  return p;
}
