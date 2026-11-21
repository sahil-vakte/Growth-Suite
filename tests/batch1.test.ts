import { describe, it, expect } from "vitest";
import { formDefinitionProblems } from "@/lib/engines/formDefinition";
import { srcSetFor } from "@/lib/engines/srcset";

describe("form definition validation", () => {
  const ok = [{ key: "name", label: "Name", type: "text" }, { key: "amount", label: "Amount", type: "number" }, { key: "total", label: "Total", type: "calculated", formula: "{amount} * 2" }];
  it("accepts a valid form", () => expect(formDefinitionProblems(ok)).toEqual([]));
  it("rejects duplicate keys, bad keys, unknown types, missing options, bad formulas and broken conditions", () => {
    const p = formDefinitionProblems([
      { key: "name", label: "A", type: "text" }, { key: "name", label: "B", type: "text" }, { key: "Bad Key", label: "C", type: "text" },
      { key: "x", label: "D", type: "slider" }, { key: "pick", label: "E", type: "select", options: [] },
      { key: "calc", label: "F", type: "calculated", formula: "2 +* 3" }, { key: "cond", label: "G", type: "text", showIf: { field: "ghost", equals: "1" } },
    ]).join(" ");
    for (const s of ["used twice", "must start with a letter", "unknown type", "at least one option", "formula problem", "does not exist"]) expect(p).toContain(s);
    expect(formDefinitionProblems([])).toContain("Add at least one field.");
  });
});

describe("responsive images", () => {
  it("builds srcset only for optimised uploads", () => {
    expect(srcSetFor("/uploads/s/2026-11/abc-photo-full.webp")).toBe("/uploads/s/2026-11/abc-photo-w480.webp 480w, /uploads/s/2026-11/abc-photo-w960.webp 960w, /uploads/s/2026-11/abc-photo-full.webp 2000w");
    expect(srcSetFor("https://example.com/photo.jpg")).toBeUndefined();
  });
});
