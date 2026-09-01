#!/usr/bin/env node
// Self-test for audio per-op buildInput() + duration validation + ext + pickUrl. No key/network.
// Focus: the per-op field divergence (text vs prompt, duration vs seconds_total, audio_format vs output_format).

import { OPS, DEFAULT_VOICE, buildInput, isValidDuration, extFor, pickUrl } from "./audio.mjs";

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failed++; };

// 1) op → model map.
check("tts slug", OPS.tts.slug === "minimax/speech-02-turbo");
check("music slug", OPS.music.slug === "meta/musicgen");
check("sfx slug", OPS.sfx.slug === "stackadoc/stable-audio-open-1.0");

// 2) tts input: `text` + voice_id (default voice) + audio_format; NO duration.
const t = buildInput(OPS.tts, "hello", {});
check("tts uses text field", t.text === "hello" && !("prompt" in t));
check("tts default voice_id", t.voice_id === DEFAULT_VOICE);
check("tts audio_format", t.audio_format === "mp3");
check("tts has no duration key", !("duration" in t) && !("seconds_total" in t));

// 3) music input: `prompt` + duration + output_format.
const m = buildInput(OPS.music, "lofi rain", { duration: 12 });
check("music uses prompt field", m.prompt === "lofi rain" && !("text" in m));
check("music duration field", m.duration === 12);
check("music output_format", m.output_format === "mp3" && !("audio_format" in m));

// 4) sfx input: `prompt` + seconds_total; no format field.
const s = buildInput(OPS.sfx, "sword clang", { duration: 3 });
check("sfx uses prompt field", s.prompt === "sword clang");
check("sfx seconds_total field", s.seconds_total === 3 && !("duration" in s));
check("sfx has no format field", !("output_format" in s) && !("audio_format" in s));

// 5) duration validation: positive ints ok, null ok, 0/neg/float/NaN rejected.
check("duration null ok", isValidDuration(null) === true);
check("duration 8 ok", isValidDuration(8) === true);
check("duration 0 invalid", isValidDuration(0) === false);
check("duration -3 invalid", isValidDuration(-3) === false);
check("duration 2.5 invalid", isValidDuration(2.5) === false);
check("duration NaN invalid", isValidDuration(Number("x")) === false);

// 6) ext follows format where supported; sfx is always wav.
check("tts ext follows format", extFor(OPS.tts, "wav") === "wav" && extFor(OPS.tts, "") === "mp3");
check("sfx ext always wav", extFor(OPS.sfx, "mp3") === "wav");

// 7) outputs are plain strings -> pickUrl works (no object gotcha).
check("pickUrl string", pickUrl("http://x/a.mp3") === "http://x/a.mp3");
check("pickUrl array", pickUrl(["http://x/a.wav"]) === "http://x/a.wav");
check("pickUrl null", pickUrl(null) === null);

console.log(failed ? `\n${failed} FAILED` : "\nall self-tests passed");
process.exit(failed ? 1 : 0);
