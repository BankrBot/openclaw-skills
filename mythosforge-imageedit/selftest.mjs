#!/usr/bin/env node
// Self-test for imageedit op-config + output-URL picking. No key/network needed.

import { OPS, pickUrl } from "./imageedit.mjs";

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failed++; };

// 1) both ops present.
check("edit slug", OPS.edit.slug === "black-forest-labs/flux-kontext-pro");
check("inpaint slug", OPS.inpaint.slug === "black-forest-labs/flux-fill-pro");
check("edit needs no mask", OPS.edit.needsMask === false);
check("inpaint needs mask", OPS.inpaint.needsMask === true);

// 2) edit input shape: prompt + input_image (no mask).
const e = OPS.edit.input("data:img", { prompt: "make it snowy" });
check("edit input has prompt + input_image", e.prompt === "make it snowy" && e.input_image === "data:img" && !("mask" in e));

// 3) inpaint input shape: prompt + image + mask.
const i = OPS.inpaint.input("data:img", { prompt: "a red door", maskRef: "data:mask" });
check("inpaint input has prompt + image + mask", i.prompt === "a red door" && i.image === "data:img" && i.mask === "data:mask");

// 4) pickUrl handles string / array / object.url / null.
check("pickUrl string", pickUrl("http://x/y.png") === "http://x/y.png");
check("pickUrl array (first string)", pickUrl(["http://a", "http://b"]) === "http://a");
check("pickUrl object.url", pickUrl({ url: "http://z" }) === "http://z");
check("pickUrl null -> null", pickUrl(null) === null);

console.log(failed ? `\n${failed} FAILED` : "\nall self-tests passed");
process.exit(failed ? 1 : 0);
