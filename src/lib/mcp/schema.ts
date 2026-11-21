import { z } from "zod";

/** Minimal Zod → JSON Schema conversion for MCP tool input schemas. */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def as { typeName: string; [k: string]: unknown };
  switch (def.typeName) {
    case "ZodObject": {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = zodToJsonSchema(v as z.ZodTypeAny);
        if (!(v as z.ZodTypeAny).isOptional()) required.push(k);
      }
      return {
        type: "object",
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false,
      };
    }
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return {
        type: (def.checks as { kind: string }[] | undefined)?.some((c) => c.kind === "int")
          ? "integer"
          : "number",
      };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "string", enum: def.values };
    case "ZodArray":
      return { type: "array", items: zodToJsonSchema(def.type as z.ZodTypeAny) };
    case "ZodRecord":
      return { type: "object", additionalProperties: true };
    case "ZodOptional":
    case "ZodNullable":
      return zodToJsonSchema(def.innerType as z.ZodTypeAny);
    case "ZodDefault":
      return {
        ...zodToJsonSchema(def.innerType as z.ZodTypeAny),
        default: (def.defaultValue as () => unknown)(),
      };
    default:
      return {};
  }
}
