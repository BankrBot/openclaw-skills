---
name: hermesone
description: Install, update, and manage the Hermes One desktop app via the `hermesone` npm package. Use when a user wants to set up Hermes One, install or upgrade it from the command line, check the installed version, preview a release before installing, pin a specific version, or drive the installer programmatically from Node. Triggers on mentions of hermesone, Hermes One, Hermes Desktop (the former name), or installing/updating the Hermes app.
license: ISC
compatibility: Requires Node.js 18+ (built-in fetch) and network access to GitHub. Cross-platform — macOS (signed app, arm64/x64), Windows (setup.exe), Linux (.AppImage). The interactive UI needs a TTY; in non-interactive contexts it falls back to plain output. Works in Claude Code and any environment with a shell and npm.
metadata:
  author: fathah
  version: "0.2.0"
---

# Hermesone: Install & Update Hermes One

`hermesone` (v0.2.0) is the npm package that installs and updates the **Hermes One** desktop app. It detects the host OS/arch, downloads the matching GitHub release, **verifies its sha512 checksum**, and installs it — on macOS the signed app goes straight into `/Applications`, ready to launch (no drag step). It ships a CLI and a programmatic API.

> ⚠️ **This installs and runs third-party native code on the user's machine.** The package mitigates this — it verifies every download against the publisher's sha512 manifest (and refuses to run an unverified build), and in an interactive terminal it asks for confirmation first — but installing software is still a host-level action. See [Safety & approval](#safety--approval).

- **Homepage:** https://hermesone.org
- **Package repository:** https://github.com/hermesonehq/hermesonejs
- **App releases pulled from:** [`fathah/hermes-desktop`](https://github.com/fathah/hermes-desktop) (GitHub releases)

> **Naming:** the app is **Hermes One** (formerly "Hermes Desktop"). The GitHub repo it's released from is still named `fathah/hermes-desktop`, and the installed macOS bundle is `Hermes One.app` — so you'll see both names. Use "Hermes One" with users; the `hermes-desktop` slug is just where the release assets live.

> **Why this lives in Bankr Skills.** Hermes One is building toward an agent economy, with [Bankr](https://bankr.bot) as the primary transaction layer for agent payments. This skill is the entry point: it gets Hermes One installed and current on the host so an agent can participate. **Today** the package does install/update/version only — no accounts, keys, or onchain actions. Bankr-settled transactions and agent-economy hooks are **on the roadmap** and will be documented here as they ship.

## Safety & approval

Installing or updating Hermes One modifies the host. The package enforces two guardrails for you: it **verifies sha512** before installing (fail-closed — it refuses if no published checksum is found), and on an interactive terminal it shows a confirmation prompt with the release, size, and checksum status. Still follow these rules:

- **Require explicit user approval before any install or update.** Never trigger one as a silent side effect of another task or an autonomous workflow.
- **In non-interactive/agent contexts the confirm prompt is skipped** (and `--yes` does the same). There, *you* are the approval gate: run [`hermesone plan`](#preview-a-release) first, show the user the resolved release/asset/size/sha512, get a yes, then run `install`.
- **Don't override verification.** Only set `HERMESONE_ALLOW_UNVERIFIED=1` if the user explicitly accepts installing a build with no published checksum.
- **Pin what you install** (`@0.2.0` for the package; a release tag for the app) when reproducibility matters — see [Pinning](#pin-a-specific-release).

## Recommended flow

Installing the npm package no longer installs the app as a side effect (see [Postinstall behavior](#postinstall-behavior)). The clean path is: install the CLI, preview, then install on confirmation.

```bash
# 1. Install the CLI (no host change — the app is not installed yet).
npm install -g hermesone@0.2.0

# 2. Preview the exact release that would be installed.
hermesone plan

# 3. Install. Interactive terminals show a confirmation prompt + live progress;
#    non-interactive contexts proceed (add --yes to be explicit) and print plain lines.
hermesone install
```

`hermesone update` is safe to run repeatedly — it no-ops when already current and only downloads when a newer release exists.

## Preview a release

`hermesone plan [tag]` resolves and prints what *would* be installed — release tag, asset, size, and the expected sha512 — **without downloading or installing anything**. Use it to show the user before asking them to approve an install.

## CLI reference

```
hermesone <command> [tag]
```

| Command          | Description                                                                          |
| ---------------- | ------------------------------------------------------------------------------------ |
| `install [tag]`  | Download, verify (sha512), and install Hermes One — latest, or a pinned release tag. |
| `update [tag]`   | Update Hermes One if a newer release is available (no-op when current).              |
| `plan [tag]`     | Show what would be downloaded (tag, asset, size, expected checksum). No changes.     |
| `version`        | Print the installed Hermes One version, or a "not installed" message.                |
| `help`           | Show usage.                                                                          |

| Flag / Env                     | Effect                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `-y`, `--yes`                  | Skip the confirmation prompt (for non-interactive/scripted installs).        |
| `HERMESONE_VERSION=<tag>`      | Pin the release tag (same as the `[tag]` argument).                          |
| `HERMESONE_ALLOW_UNVERIFIED=1` | Proceed even if no published checksum is found. Not recommended.            |

In an interactive terminal, `install` renders a confirmation box, a live download progress bar, and per-step status (resolve → download → verify → install). In a non-interactive context it prints plain status lines and never blocks. Color honors `NO_COLOR`.

## What gets installed per OS

| OS      | Artifact             | Behavior                                                                                          |
| ------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| macOS   | `*-mac.zip` (signed) | Verified, unzipped, installed into `/Applications` (or `~/Applications`), then launched — no drag. Updates replace in place. |
| Windows | `*-setup.exe`        | Verified, then the installer is launched.                                                         |
| Linux   | `*.AppImage`         | Verified, marked executable, then launched.                                                       |

## Pin a specific release

`install`/`update` use the **latest** release by default. To install a known build, pass a tag or set the env var:

```bash
hermesone install v0.6.35
HERMESONE_VERSION=v0.6.35 hermesone install
```

## Checksum verification (built in)

Each download is verified against the base64 sha512 published in the release's electron-builder manifest (`latest-mac.yml` / `latest.yml` / `latest-linux.yml`). On mismatch the file is deleted and nothing is installed. If a release publishes no checksum for the asset, `install` refuses unless `HERMESONE_ALLOW_UNVERIFIED=1` is set. You do not need to verify manually — surface the result from `plan` to the user and let the package enforce it.

## Programmatic API

```ts
import { plan, install, update, getInstalledVersion } from "hermesone";

// Preview without downloading — show this to the user for approval.
const p = await plan();                       // { tag, asset, url, size, sha512 }

// Install (verifies sha512 before installing). Optionally pin a tag, and/or
// subscribe to progress events to render your own UI.
await install({
  tag: "v0.6.35",
  onProgress: (e) => console.log(e.phase),    // resolve|download|verify|extract|launch|installed...
});

await update();                                // no-op if already current
const current = await getInstalledVersion();   // e.g. "0.6.35", or null
```

Also exported: `fetchRelease`, `parseChecksums`, `selectAsset`, `getTarget`, `isNewer`, and types `Release`, `ReleaseAsset`, `State`, `Target`, `InstallOptions`, `InstallPlan`, `ProgressEvent`. The library prints nothing on its own — all output is driven by your `onProgress` handler.

## Version tracking

- The installed version is detected from the app on disk first. On macOS this reads `CFBundleShortVersionString` from `Hermes One.app/Contents/Info.plist` (`/Applications` and `~/Applications`), so manual installs are recognized too.
- Otherwise it falls back to `~/.hermesone/state.json`, written after each install/update done through this tool.
- `version` returns `null` (CLI prints "Hermes One is not installed.") when neither source yields a version.

## Postinstall behavior

`npm install hermesone` **does not** download or launch the app — running an installer as a silent side effect of `npm install` is surprising, so it's opt-in. After installing the package it prints the next step (`npx hermesone install`). Controls:

| Env (set before `npm install`) | Effect                                                            |
| ------------------------------ | ---------------------------------------------------------------- |
| _(none)_                       | Prints guidance; does not install the app.                       |
| `HERMESONE_AUTO_INSTALL=1`     | Runs the install automatically during postinstall.               |
| `HERMESONE_SKIP_INSTALL=1`     | Silences the postinstall notice entirely.                        |

## Troubleshooting

| Symptom                                                | Cause / fix                                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `No published checksum found for <asset>`              | The release has no sha512 manifest entry for this asset. Prefer a release that does; only override with `HERMESONE_ALLOW_UNVERIFIED=1` if the user accepts it. |
| `Checksum mismatch for <asset>`                        | The download didn't match the published sha512 — the file was deleted and nothing installed. Retry; if it persists, the release/asset may be compromised or corrupted. |
| `Failed to fetch release ...: 403`                     | GitHub API rate limit (unauthenticated). Wait and retry.                                                                                   |
| `No Hermes One build available for <platform>/<arch>`  | The release has no asset for this OS/arch. Check the [releases page](https://github.com/fathah/hermes-desktop/releases).                   |
| Prompt didn't appear / it just proceeded               | Not a TTY (CI, pipe, agent). That's expected — it runs non-interactively. Use `plan` first to gate, or `--yes` to be explicit.            |
| `version` says not installed after a manual install    | Only macOS auto-detects from disk. On Windows/Linux, install once via this tool so `~/.hermesone/state.json` is written.                   |

## Notes & guardrails

- **Host-level code execution.** Install/update download a native build from `fathah/hermes-desktop` and run it. The package verifies sha512 and (interactively) prompts, but only run it on explicit user intent — never automatically from an agent workflow.
- **Preview, then install.** Use `plan` to show the release/asset/size/sha512; in non-interactive contexts that preview is your approval gate.
- **No credentials.** The tool needs no API key or account and performs no onchain or payment actions.
