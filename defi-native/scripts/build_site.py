#!/usr/bin/env python3
"""Fail the build if any number on site/index.html has drifted from the skill.

The site is hand authored, not generated. This is the gate that stops the
marketing page from quietly outliving the thing it describes: if a source is
added to the manifest or a route to the router, the printed figure has to move
with it. Run with no arguments; exits non zero and says what to change.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "site" / "index.html"


def skill_version() -> str:
    text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    match = re.search(r"^\s*version:\s*([0-9.]+)\s*$", text, re.M)
    if not match:
        sys.exit("could not read metadata.version from SKILL.md")
    return match.group(1)


def counts() -> dict:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    routes = json.loads((ROOT / "api-routes.json").read_text(encoding="utf-8"))
    evals = json.loads((ROOT / "evals" / "evals.json").read_text(encoding="utf-8"))
    glossary = (ROOT / "references" / "glossary.md").read_text(encoding="utf-8")
    return {
        "sources": len(manifest["sources"]),
        "live data routes": len(routes["routes"]),
        "glossary terms": sum(1 for line in glossary.splitlines() if line.startswith("- ")),
        "graded evals": len(evals["evals"]),
    }


ASSET_PAGES = {
    ROOT / "site" / "index.html": "assets/",
    ROOT / "site" / "update" / "index.html": "../assets/",
}
ASSETS = ["site.css", "site.js"]


def asset_hash(name: str) -> str:
    import hashlib

    data = (ROOT / "site" / "assets" / name).read_bytes()
    return hashlib.sha256(data).hexdigest()[:8]


def stamp_assets() -> None:
    """Rewrite the css/js references on both pages to carry the current
    content hash, so a changed asset always gets a fresh URL. Run after
    editing site/assets/*; the default gate mode verifies the stamp."""
    for page, prefix in ASSET_PAGES.items():
        text = page.read_text(encoding="utf-8")
        for name in ASSETS:
            pattern = re.escape(prefix + name) + r"(?:\?v=[0-9a-f]{8})?"
            text = re.sub(pattern, f"{prefix}{name}?v={asset_hash(name)}", text)
        page.write_text(text, encoding="utf-8")
        print(f"stamped {page.relative_to(ROOT)}")


def unlisted_key_sources(page: str) -> list:
    """Every must- or core-priority manifest source has to be NAMED in the
    page's data-sources list. Thin/should rows may stay under "+ many more";
    the ones the skill leans on hardest may not silently vanish from the
    census. Matching is lenient (any word of the name, case-insensitive) so
    it errs toward passing; it exists to catch wholesale omissions."""
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    start = page.find("View all data sources")
    end = page.find("</details>", start)
    if start < 0 or end < 0:
        return ["data-sources list block not found on the page"]
    block = page[start:end].lower()
    problems = []
    for source in manifest["sources"]:
        if source.get("priority") not in ("must", "core"):
            continue
        key = re.sub(r"\(.*?\)", "", source["name"]).strip()
        words = [w for w in re.split(r"[ /]", key) if len(w) > 3]
        hit = any(w.lower() in block for w in words) or key.lower() in block
        if not hit:
            problems.append(
                f'{source["priority"]}-priority source "{source["name"]}" is not '
                f"named in the data-sources list"
            )
    return problems


def main() -> int:
    if "--stamp" in sys.argv:
        stamp_assets()
        return 0

    if not PAGE.exists():
        sys.exit(f"missing {PAGE.relative_to(ROOT)}")

    page = PAGE.read_text(encoding="utf-8")
    problems = []

    for page_path, prefix in ASSET_PAGES.items():
        text = page_path.read_text(encoding="utf-8")
        for name in ASSETS:
            want = f"{prefix}{name}?v={asset_hash(name)}"
            if want not in text:
                problems.append(
                    f"{page_path.relative_to(ROOT)} does not reference {want} "
                    f"(stale asset URL; run scripts/build_site.py --stamp)"
                )

    for label, expected in counts().items():
        pattern = r'<div class="v num">(\d+)\+?</div><div class="k">' + re.escape(label) + r"</div>"
        found = re.search(pattern, page)
        if not found:
            problems.append(f'no stat on the page labelled "{label}"')
        elif int(found.group(1)) != expected:
            problems.append(
                f'"{label}": page says {found.group(1)}, the skill has {expected}'
            )

    problems.extend(unlisted_key_sources(page))

    version = skill_version()
    if f"v{version}" not in page:
        shown = re.findall(r"v(\d+\.\d+\.\d+)", page)
        problems.append(
            f"page shows version {sorted(set(shown)) or 'none'}, SKILL.md is {version}"
        )

    update_page = ROOT / "site" / "update" / "index.html"
    if update_page.exists():
        text = update_page.read_text(encoding="utf-8")
        if f"v{version}" not in text:
            problems.append(f"site/update/index.html does not mention v{version}")
        if f"{version} available" not in text:
            problems.append(
                f'site/update/index.html demo terminal does not offer "{version} available"'
            )

    if problems:
        print("site/index.html has drifted from the skill:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    print(f"site/index.html matches the skill (v{version})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
