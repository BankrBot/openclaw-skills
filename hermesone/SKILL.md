---
name: hermesone
description: Install, update, and manage the Hermes One desktop app via the `hermesone` npm package. Use when a user wants to set up Hermes One, install or upgrade it from the command line, check the installed version, automate installation in a script or postinstall hook, or call the installer programmatically from Node. Triggers on mentions of hermesone, Hermes One, Hermes Desktop (the former name), or installing/updating the Hermes app.
license: ISC
compatibility: Requires Node.js (built-in `fetch`, so Node 18+) and network access to GitHub. Cross-platform — macOS (.dmg, arm64/x64), Windows (setup.exe), and Linux (.AppImage). Works in Claude Code and any environment with a shell and npm.
metadata:
  author: fathah
  version: "0.0.4"
---

# Hermesone: Install & Update Hermes One

`hermesone` is an npm package that installs and updates the **Hermes One** desktop app. Installing the package detects the host OS and CPU architecture, downloads the matching release asset from GitHub, and launches the native installer. It also ships a CLI and a programmatic API for scripted or repeat use.

- **Homepage:** https://hermesone.org
- **Package repository:** https://github.com/hermesonehq/hermesonejs
- **App releases pulled from:** [`fathah/hermes-desktop`](https://github.com/fathah/hermes-desktop) (GitHub latest release)

> **Naming:** the app is **Hermes One** (formerly "Hermes Desktop"). The GitHub repo it's released from is still named `fathah/hermes-desktop`, and the installed macOS bundle is `Hermes One.app` — so you'll see both names. Use "Hermes One" when talking to users; the `hermes-desktop` repo slug is just where the release assets live.

> **Why this lives in Bankr Skills.** Hermes One is building toward an agent economy, with [Bankr](https://bankr.bot) as the primary transaction layer for agent payments. This skill is the entry point: it teaches an agent to install and keep Hermes One up to date so it can participate. **Today** the package does exactly that — install/update/version, no accounts or keys. Bankr-settled transactions and agent-economy hooks are **on the roadmap** and will be documented here as they ship; this skill does not yet perform any onchain or payment actions.

## Decide the install path first

Pick the path that matches what the user wants, then follow that section:

1. **Just install the app once** → [Quick install](#quick-install) (`npm install hermesone`). The postinstall hook does everything.
2. **Reusable `hermesone` command** (install, then update later, check version) → [Global install](#global-install) (`npm install -g hermesone`).
3. **Install/update from inside their own Node app or build script** → [Programmatic API](#programmatic-api).
4. **CI, Docker, or any place that must NOT pop an installer** → set `HERMESONE_SKIP_INSTALL=1`. See [Controlling the postinstall hook](#controlling-the-postinstall-hook).

The installer launches a GUI installer (opens the `.dmg`, runs `setup.exe`, or executes the `.AppImage`). It needs a desktop session — it is not meant for headless servers. In headless/CI contexts, skip the postinstall and call the API or CLI deliberately.

## Quick install

```bash
npm install hermesone
```

On install the postinstall step will:

- Detect the platform (`darwin`, `win32`, `linux`) and architecture (`arm64`, `x64`).
- Fetch the latest Hermes One release from GitHub.
- Download the matching asset — `.dmg` on macOS (arm64 or x64), `setup.exe` on Windows, `.AppImage` on Linux.
- Launch the installer and record the version in `~/.hermesone/state.json`.

If no asset matches the platform/arch, the install logs a warning and skips rather than failing the whole `npm install`.

## Global install

Installing globally puts a `hermesone` command on the user's `PATH`:

```bash
npm install -g hermesone
```

Then from any directory:

```bash
hermesone install     # Download and install the latest Hermes One
hermesone update      # Update only if a newer release exists (no-op if up to date)
hermesone version     # Print the installed version, or a "not installed" message
hermesone help        # Show usage
```

`update` is safe to run repeatedly: it compares the installed version (detected from the app on disk, falling back to `~/.hermesone/state.json`) against the latest release and only downloads when the latest is strictly newer.

## Controlling the postinstall hook

| Goal                                                                           | What to do                                                                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Install the package but **not** launch the GUI installer (CI, Docker, servers) | Set `HERMESONE_SKIP_INSTALL=1` before `npm install`, e.g. `HERMESONE_SKIP_INSTALL=1 npm install hermesone` |
| Install in a script, then trigger the install yourself later                   | Skip the hook as above, then run `npx hermesone install` (or call the API) at the right moment             |

The postinstall hook is also automatically skipped when running inside the package's own source checkout (development), so contributors don't trigger an install on `npm install`.

## Programmatic API

```ts
import { install, update, getInstalledVersion } from "hermesone";

await install(); // install the latest release now
await update(); // update only if newer; no-op otherwise
const current = await getInstalledVersion(); // e.g. "1.4.0", or null if not installed
```

Lower-level helpers are also exported for custom flows (e.g. checking for an update without downloading):

```ts
import { fetchLatestRelease, selectAsset, getTarget, isNewer } from "hermesone";

const target = getTarget(); // { platform, arch }
const release = await fetchLatestRelease();
const asset = selectAsset(release.assets, target); // the asset that would be downloaded
const current = await getInstalledVersion();
if (current && isNewer(release.tag_name, current)) {
  console.log(`Update available: ${current} -> ${release.tag_name}`);
}
```

Exported types: `Release`, `ReleaseAsset`, `State`, `Target`.

## How version tracking works

- The installed version is detected from the app on disk first. On macOS this reads `CFBundleShortVersionString` from `Hermes One.app/Contents/Info.plist` (checking `/Applications` and `~/Applications`), so a manual install is recognized too.
- If nothing is found on disk, it falls back to `~/.hermesone/state.json`, which records `{ version, installedAt }` after each install/update done through this tool.
- `version` returns `null` (CLI prints "Hermes One is not installed.") when neither source yields a version.

## Troubleshooting

| Symptom                                                   | Cause / fix                                                                                                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Failed to fetch latest release: 403`                     | GitHub API rate limit (unauthenticated). Wait and retry, or run from a network with a higher limit.                                                               |
| `No Hermes Desktop build available for <platform>/<arch>` | The latest release has no asset for this OS/arch (e.g. Linux arm). Check the [releases page](https://github.com/fathah/hermes-desktop/releases).                  |
| `npm install` finished but nothing happened               | The postinstall may have been skipped — check for `HERMESONE_SKIP_INSTALL`, a headless environment, or a source-checkout. Run `npx hermesone install` explicitly. |
| Installer downloaded but didn't open                      | The GUI installer needs a desktop session. On Linux ensure the `.AppImage` is executable and FUSE is available.                                                   |
| `version` says not installed after a manual install       | Only macOS auto-detects from disk. On Windows/Linux, install once via this tool so `~/.hermesone/state.json` is written.                                          |

## Notes & guardrails

- This tool downloads and launches an executable installer from GitHub releases. Only run it when the user actually wants to install Hermes One, and prefer pinning to the official repo (`fathah/hermes-desktop`).
- It does not require any API key, account, or credentials.
- For headless/automated environments, never rely on the postinstall hook — set `HERMESONE_SKIP_INSTALL=1` and call `install()`/`update()` explicitly where a GUI session exists.
