import { expect, it } from "vitest";
import { chooseCurrentSite } from "../src/lib/engines/currentSite";
it("keeps the default workspace stable when a maintenance update reorders rows", () => {
  const sites = [
    { id: "a", domain: "client.test" },
    { id: "b", domain: "localhost" },
  ];
  expect(chooseCurrentSite(sites, undefined, "localhost")).toBe("b");
  expect(chooseCurrentSite([...sites].reverse(), undefined, "localhost")).toBe("b");
  expect(chooseCurrentSite(sites, "a", "localhost")).toBe("a");
});
it("never selects an unauthorised site and provides a deterministic fallback", () => {
  const sites = [
    { id: "b", domain: "second.test" },
    { id: "a", domain: "first.test" },
  ];
  expect(chooseCurrentSite(sites, "foreign", "localhost")).toBe("a");
  expect(chooseCurrentSite([], "foreign", "localhost")).toBeUndefined();
});
