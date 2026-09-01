#!/usr/bin/env node
// Self-test for to3d buildInput() + pickGlb() + model config. No key/network needed.
// Focus: the OUTPUT-OBJECT extraction gotcha (a plain string/array picker returns null on success).

import { DEFAULT_SLUG, MODELS, EXT, buildInput, pickGlb, resolveConfig } from "./to3d.mjs";

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failed++; };

// 1) model config + per-model input mode / output key.
check("default slug trellis", DEFAULT_SLUG === "firtoz/trellis");
check("ext glb", EXT === "glb");
check("trellis: images array + model_file key", MODELS["firtoz/trellis"].imageMode === "array" && MODELS["firtoz/trellis"].outputKey === "model_file");
check("hunyuan: single image + mesh key", MODELS["ndreca/hunyuan3d-2"].imageMode === "single" && MODELS["ndreca/hunyuan3d-2"].outputKey === "mesh");

// 2) input builder: array vs single.
check("array mode wraps images:[ref]", JSON.stringify(buildInput("data:img", "array")) === JSON.stringify({ images: ["data:img"] }));
check("single mode uses image:ref", JSON.stringify(buildInput("data:img", "single")) === JSON.stringify({ image: "data:img" }));

// 3) THE GOTCHA: output is an object with a named key -> must extract, not return null.
check("trellis model_file extracted", pickGlb({ model_file: "https://x/model.glb", color_video: "https://x/v.mp4" }, "model_file") === "https://x/model.glb");
check("hunyuan mesh extracted", pickGlb({ mesh: "https://x/mesh.glb" }, "mesh") === "https://x/mesh.glb");
check("named key as {url:...}", pickGlb({ model_file: { url: "https://x/m.glb" } }, "model_file") === "https://x/m.glb");

// 4) fallback: unmapped model / no key -> scan object for the .glb uri.
check("scan finds .glb when key unknown", pickGlb({ whatever: "https://x/a.png", other: "https://x/out.glb" }, null) === "https://x/out.glb");
check("plain string output still works", pickGlb("https://x/model.glb", null) === "https://x/model.glb");
check("array output picks a .glb", pickGlb(["https://x/p.png", "https://x/m.glb"], null) === "https://x/m.glb");
check("empty object -> null", pickGlb({}, "model_file") === null);
check("null -> null", pickGlb(null, "model_file") === null);

// 5) resolveConfig: mapped model uses its config; unmapped requires overrides; bad image-mode rejected.
check("mapped model -> config from map", (() => { const r = resolveConfig("firtoz/trellis", "", ""); return !r.error && r.imageMode === "array" && r.outputKey === "model_file"; })());
check("unmapped model, no overrides -> error", !!resolveConfig("some/unknown", "", "").error);
check("unmapped model with both overrides -> ok", (() => { const r = resolveConfig("some/unknown", "single", "mesh"); return !r.error && r.imageMode === "single" && r.outputKey === "mesh"; })());
check("unmapped model, only image-mode -> error", !!resolveConfig("some/unknown", "single", "").error);
check("invalid image-mode -> error", !!resolveConfig("firtoz/trellis", "nope", "").error);
check("override on mapped model honored", resolveConfig("firtoz/trellis", "single", "custom_key").imageMode === "single");

console.log(failed ? `\n${failed} FAILED` : "\nall self-tests passed");
process.exit(failed ? 1 : 0);
