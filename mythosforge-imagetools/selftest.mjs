#!/usr/bin/env node
// Self-test for imagetools op-config + output-URL picking. No key/network needed.

import { OPS, pickUrl } from "./imagetools.mjs";

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failed++; };

// 1) both ops present with the expected slugs.
check("upscale slug", OPS.upscale.slug === "nightmareai/real-esrgan");
check("bg-remove slug", OPS["bg-remove"].slug === "cjwbw/rembg");

// 2) upscale input shape carries image + scale + face_enhance.
const up = OPS.upscale.input("data:...", { scale: 4 });
check("upscale input has image/scale/face_enhance", up.image === "data:..." && up.scale === 4 && up.face_enhance === false);

// 3) bg-remove input is just the image.
const bg = OPS["bg-remove"].input("data:...");
check("bg-remove input is { image }", bg.image === "data:..." && Object.keys(bg).length === 1);

// 4) pickUrl handles string / array / object.url / null.
check("pickUrl string", pickUrl("http://x/y.png") === "http://x/y.png");
check("pickUrl array (first string)", pickUrl(["http://a", "http://b"]) === "http://a");
check("pickUrl object.url", pickUrl({ url: "http://z" }) === "http://z");
check("pickUrl null -> null", pickUrl(null) === null);
check("pickUrl empty array -> null", pickUrl([]) === null);

console.log(failed ? `\n${failed} FAILED` : "\nall self-tests passed");
process.exit(failed ? 1 : 0);
