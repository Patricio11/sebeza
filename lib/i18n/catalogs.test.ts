/**
 * Translation catalog integrity (zu / xh / af against the en base).
 *
 * The non-English catalogs are deep-merged over English at request time
 * (i18n/request.ts), so missing keys are legal (they fall back). What is
 * NEVER legal:
 *   - a key that doesn't exist in English (dead translation, likely typo);
 *   - an ICU placeholder set that differs from English (renders broken
 *     text or throws at runtime);
 *   - untranslated English text sneaking in as a "translation" is fine
 *     during rollout, but structure must always hold.
 *
 * Consent / POPIA / legal strings are deliberately absent from zu/xh/af
 * until the human reviewer signs them off (docs/TRANSLATION_REVIEW_GUIDE.md);
 * this suite PINS that hold so nobody wires them in by accident.
 */
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import zu from "../../messages/zu.json";
import xh from "../../messages/xh.json";
import af from "../../messages/af.json";

type Tree = { [k: string]: unknown };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else if (v && typeof v === "object") {
      for (const [ck, cv] of flatten(v as Tree, key)) out.set(ck, cv);
    }
  }
  return out;
}

// Top-level ICU argument names of a message ({name}, {n, plural, ...}).
// The flush happens on the CLOSING brace of a top-level argument, so
// messages that end with "}" keep their final argument.
function icuArgs(message: string): string[] {
  const args = new Set<string>();
  let depth = 0;
  let current = "";
  for (const ch of message) {
    if (ch === "{") {
      depth += 1;
      if (depth === 1) current = "";
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0 && current) {
        args.add(current.split(",")[0]!.trim());
        current = "";
      }
      continue;
    }
    if (depth === 1) current += ch;
  }
  return [...args].sort();
}

const enFlat = flatten(en as Tree);
const LOCALES: Array<[string, Tree]> = [
  ["zu", zu as Tree],
  ["xh", xh as Tree],
  ["af", af as Tree],
];

// The human-review hold: these subtrees must stay ENGLISH (absent from the
// locale catalogs) until the reviewer signs off the drafts in
// docs/TRANSLATION_REVIEW_GUIDE.md. Remove a prefix here in the same commit
// that lands its reviewed translations.
const CONSENT_HOLD_PREFIXES = [
  "auth.seekerSignUp.step2",
  "seekerDash.privacy",
  "auth.seekerSignUp.stepHints.id",
  "seekerDash.profileEditor.fields.nationalIdHelp",
];

describe.each(LOCALES)("messages/%s.json", (name, tree) => {
  const flat = flatten(tree);

  it("only contains keys that exist in English (plus __notice)", () => {
    const unknown = [...flat.keys()].filter(
      (k) => k !== "__notice" && !enFlat.has(k),
    );
    expect(unknown).toEqual([]);
  });

  it("preserves every ICU placeholder exactly", () => {
    const broken: string[] = [];
    for (const [key, value] of flat) {
      if (key === "__notice") continue;
      const base = enFlat.get(key);
      if (base === undefined) continue;
      if (icuArgs(base).join("|") !== icuArgs(value).join("|")) {
        broken.push(
          `${key}: en args [${icuArgs(base)}] vs ${name} args [${icuArgs(value)}]`,
        );
      }
    }
    expect(broken).toEqual([]);
  });

  it("holds consent/POPIA/legal strings on English until human review", () => {
    const leaked = [...flat.keys()].filter((k) =>
      CONSENT_HOLD_PREFIXES.some((p) => k === p || k.startsWith(`${p}.`)),
    );
    expect(leaked).toEqual([]);
  });

  it("covers the overwhelming majority of the UI", () => {
    const held = [...enFlat.keys()].filter((k) =>
      CONSENT_HOLD_PREFIXES.some((p) => k === p || k.startsWith(`${p}.`)),
    ).length;
    const translatable = enFlat.size - held;
    const covered = [...flat.keys()].filter((k) => k !== "__notice").length;
    expect(covered / translatable).toBeGreaterThan(0.95);
  });
});
