#!/usr/bin/env node
// Self-test for brandkit's normalizeToken() / isUsable(). No key/network needed.
// Proves author-mode fill/validate produces a complete, well-formed token from any partial input.

import { normalizeToken, isUsable } from "./brandkit.mjs";

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failed++; };

// 1) Empty input -> complete shape with all fields present (no crash, no missing keys).
const empty = normalizeToken({}, "");
check("empty -> name default", empty.name === "untitled-theme");
check("empty -> palette object present", Array.isArray(empty.palette.base) && empty.palette.accents_allowed.length === 0);
check("empty -> typography object present", "display" in empty.typography && "mono" in empty.typography);
check("empty -> not usable", isUsable(empty) === false);

// 2) name override wins.
check("name override applied", normalizeToken({ name: "x" }, "dusk-neon").name === "dusk-neon");

// 3) Partial authored token fills + preserves.
const partial = normalizeToken({ palette: { base: ["#1c1830"], accent_primary: "#8a63d2" }, feel_words: ["neon", 7, "civic"] }, "");
check("partial -> palette preserved", partial.palette.base[0] === "#1c1830" && partial.palette.accent_primary === "#8a63d2");
check("partial -> non-string feel_words filtered", partial.feel_words.length === 2 && partial.feel_words.join() === "neon,civic");
check("partial with palette -> usable", isUsable(partial) === true);

// 4) Type coercion: bad types don't crash and become safe defaults.
const bad = normalizeToken({ palette: "nope", typography: 5, feel_words: "not-an-array", prompt_suffix: 42 }, "");
check("bad palette -> empty arrays/strings", Array.isArray(bad.palette.base) && bad.palette.base.length === 0);
check("bad typography -> empty strings", bad.typography.display === "" && bad.typography.body === "");
check("bad feel_words (string) -> empty array", Array.isArray(bad.feel_words) && bad.feel_words.length === 0);
check("bad prompt_suffix (number) -> empty string", bad.prompt_suffix === "");

// 5) accent_primary alone is enough to be usable (no base array).
check("accent_primary only -> usable", isUsable(normalizeToken({ palette: { accent_primary: "#8a63d2" } }, "")) === true);

console.log(failed ? `\n${failed} FAILED` : "\nall self-tests passed");
process.exit(failed ? 1 : 0);
