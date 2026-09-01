#!/usr/bin/env node
// Self-test for video buildInput() + pickUrl() + model config. No key/network needed.

import { DEFAULT_SLUG, MODELS, EXT, buildInput, pickUrl, isValidDuration } from "./video.mjs";

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failed++; };

// 1) model config + per-model image-field map.
check("default slug seedance", DEFAULT_SLUG === "bytedance/seedance-2.0");
check("ext mp4", EXT === "mp4");
check("seedance image field = image", MODELS["bytedance/seedance-2.0"].imageField === "image");
check("hailuo image field = first_frame_image", MODELS["minimax/hailuo-2.3"].imageField === "first_frame_image");

// 2) text-only input: just prompt (no image key, no duration/resolution unless set).
const t = buildInput("a drone shot", undefined, null, {});
check("text input is prompt only", JSON.stringify(t) === JSON.stringify({ prompt: "a drone shot" }));

// 3) image-to-video with the model's field (seedance -> `image`).
const iv = buildInput("push in", "data:img", "image", {});
check("image goes into `image` field", iv.image === "data:img" && iv.prompt === "push in");

// 4) different model's field name honored (hailuo -> `first_frame_image`).
const hv = buildInput("push in", "data:img", "first_frame_image", {});
check("image goes into first_frame_image", hv.first_frame_image === "data:img" && !("image" in hv));

// 5) duration/resolution only added when provided.
const opt = buildInput("x", undefined, null, { duration: 6, resolution: "720p" });
check("duration/resolution passthrough", opt.duration === 6 && opt.resolution === "720p");

// 6) duration validation: null (unset) ok, integers ok (incl -1), NaN/floats rejected.
check("duration null (unset) valid", isValidDuration(null) === true);
check("duration 6 valid", isValidDuration(6) === true);
check("duration -1 (auto) valid", isValidDuration(-1) === true);
check("duration 6.5 invalid", isValidDuration(6.5) === false);
check("duration NaN invalid", isValidDuration(Number("abc")) === false);

// 7) pickUrl handles string / array / object.url / null.
check("pickUrl string", pickUrl("http://x/y.mp4") === "http://x/y.mp4");
check("pickUrl array (first string)", pickUrl(["http://a", "http://b"]) === "http://a");
check("pickUrl object.url", pickUrl({ url: "http://z" }) === "http://z");
check("pickUrl null -> null", pickUrl(null) === null);

console.log(failed ? `\n${failed} FAILED` : "\nall self-tests passed");
process.exit(failed ? 1 : 0);
