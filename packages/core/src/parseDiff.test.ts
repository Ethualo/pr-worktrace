import { describe, it, expect } from "vitest";
import { parseDiff } from "./parseDiff.js";

const sampleDiff = `diff --git a/src/geo.ts b/src/geo.ts
index 1234567..89abcde 100644
--- a/src/geo.ts
+++ b/src/geo.ts
@@ -10,3 +10,4 @@ export function haversine(a, b) {
   const dLat = toRad(b.lat - a.lat);
   const dLon = toRad(b.lon - a.lon);
+  const R = 6371;
   return R * c;
 }
`;

describe("parseDiff", () => {
  it("extracts touched files with their added-line ranges", () => {
    const files = parseDiff(sampleDiff);
    expect(files).toEqual([
      {
        path: "src/geo.ts",
        addedLines: [{ line: 12, content: "  const R = 6371;" }],
      },
    ]);
  });

  it("returns empty array for empty diff", () => {
    expect(parseDiff("")).toEqual([]);
  });
});
