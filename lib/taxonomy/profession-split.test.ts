import { describe, expect, test } from "vitest";
import {
  hasProfessionSeparator,
  mergeSecondaryProfessions,
  splitProfessionText,
} from "./profession-split";

const CANON = ["Software Developer", "Chef", "UX/UI Designer", "Electrician"];

describe("splitProfessionText", () => {
  test("the founder's queue row: pipe = primary + secondary, both custom", () => {
    const r = splitProfessionText(
      "AI Automation & Systems Specialist | Supply Chain & Admin Solutions Architect",
      CANON,
    );
    expect(r.primary).toBe("AI Automation & Systems Specialist");
    expect(r.secondaries).toEqual(["Supply Chain & Admin Solutions Architect"]);
    expect(r.customParts).toEqual([
      "AI Automation & Systems Specialist",
      "Supply Chain & Admin Solutions Architect",
    ]);
    expect(r.wasSplit).toBe(true);
  });

  test("a canonical part is used as its label and raises no suggestion", () => {
    const r = splitProfessionText("chef | Baker", CANON);
    expect(r.primary).toBe("Chef");
    expect(r.secondaries).toEqual(["Baker"]);
    expect(r.customParts).toEqual(["Baker"]);
  });

  test("slash with spaces splits; a bare slash does not", () => {
    expect(splitProfessionText("Driver / Operator", CANON).secondaries).toEqual(["Operator"]);
    const bare = splitProfessionText("Driver/Operator", CANON);
    expect(bare.wasSplit).toBe(false);
    expect(bare.primary).toBe("Driver/Operator");
  });

  test("a canonical label containing a slash is never split", () => {
    const r = splitProfessionText("ux/ui designer", CANON);
    expect(r).toEqual({ primary: "UX/UI Designer", secondaries: [], customParts: [], wasSplit: false });
  });

  test("duplicates and empty parts are dropped; secondaries cap at 3", () => {
    const r = splitProfessionText("A1 | a1 |  | B2 | C3 | D4 | E5", CANON);
    expect(r.primary).toBe("A1");
    expect(r.secondaries).toEqual(["B2", "C3", "D4"]);
  });

  test("plain text passes through untouched", () => {
    const r = splitProfessionText("Boilermaker", CANON);
    expect(r).toEqual({ primary: "Boilermaker", secondaries: [], customParts: ["Boilermaker"], wasSplit: false });
    expect(hasProfessionSeparator("Boilermaker")).toBe(false);
    expect(hasProfessionSeparator("Boilermaker | Welder")).toBe(true);
  });
});

describe("mergeSecondaryProfessions", () => {
  test("keeps order, drops the primary and duplicates, caps at 3", () => {
    expect(
      mergeSecondaryProfessions("Chef", ["Baker", "chef"], ["Baker", "Pastry Chef", "Sommelier", "Barista"]),
    ).toEqual(["Baker", "Pastry Chef", "Sommelier"]);
  });
});
