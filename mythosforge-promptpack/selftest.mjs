#!/usr/bin/env node
// Self-test for promptpack composePrompt() / loadRecipes(). No key/network needed.

import { composePrompt, loadRecipes } from "./promptpack.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
let failed = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failed++; };

// 1) bundled recipe library loads and is non-empty.
const recipes = await loadRecipes(join(HERE, "recipes.json"));
check("recipes.json loads (>=1)", Array.isArray(recipes) && recipes.length >= 1);
check("every recipe has id/model/aspect/template", recipes.every((r) => r.id && r.model && r.aspect && r.template.includes("{subject}")));

// 2) {subject} substitution.
const r = { id: "x", template: "{subject}, neon noir, cinematic", model: "flux", aspect: "landscape", negative: "flat" };
const c = composePrompt(r, "a lone fox", null);
check("subject substituted", c.prompt.startsWith("a lone fox, neon noir"));
check("model/aspect/negative carried", c.model === "flux" && c.aspect === "landscape" && c.negative === "flat");
check("no leftover placeholder", !c.prompt.includes("{subject}"));

// 3) template without {subject} -> subject prepended.
const c2 = composePrompt({ id: "y", template: "watercolor", model: "flux", aspect: "square" }, "a cat", null);
check("no-placeholder template prepends subject", c2.prompt === "a cat, watercolor");

// 4) brandkit theme merge: feel_words + prompt_suffix appended, anti_feel -> negative.
const theme = { feel_words: ["nocturnal", "neon"], prompt_suffix: "dark-violet neon", anti_feel: ["beige", "daytime"] };
const c3 = composePrompt(r, "a fox", theme);
check("theme feel_words appended", c3.prompt.includes("nocturnal, neon"));
check("theme prompt_suffix appended", c3.prompt.includes("dark-violet neon"));
check("theme anti_feel merged into negative", c3.negative.includes("beige") && c3.negative.includes("flat"));

// 5) robust to junk theme / missing fields.
const c4 = composePrompt(r, "a fox", { feel_words: "not-array", prompt_suffix: 5 });
check("junk theme ignored, no crash", c4.prompt === "a fox, neon noir, cinematic");

console.log(failed ? `\n${failed} FAILED` : "\nall self-tests passed");
process.exit(failed ? 1 : 0);
