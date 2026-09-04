#!/usr/bin/env python3
"""Collect the files a ChatGPT Custom GPT needs into one folder.

ChatGPT's Knowledge uploader takes 20 files and has no folder support, so this
flattens the skill into dist/chatgpt-knowledge/ ready to drag in. Refuses to run
if the skill has outgrown the limit, because a silent truncation would leave a
Custom GPT quietly missing a reference file.
"""

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "chatgpt-knowledge"
LIMIT = 20


def main() -> int:
    files = [ROOT / "SKILL.md", ROOT / "manifest.json", ROOT / "api-routes.json"]
    files += sorted((ROOT / "references").glob("*.md"))

    missing = [f for f in files if not f.exists()]
    if missing:
        sys.exit("missing: " + ", ".join(str(f.relative_to(ROOT)) for f in missing))

    if len(files) > LIMIT:
        sys.exit(
            f"{len(files)} files, but ChatGPT Knowledge allows {LIMIT}.\n"
            "Decide what to drop rather than letting this truncate silently."
        )

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    total = 0
    for f in files:
        shutil.copy2(f, OUT / f.name)
        total += f.stat().st_size

    print(f"{len(files)} files, {total / 1024:.0f} KB -> {OUT.relative_to(ROOT)}")
    print(f"{LIMIT - len(files)} slot(s) left before ChatGPT's limit")
    print("\nNext: paste chatgpt/INSTRUCTIONS.md into Instructions, upload these under Knowledge.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
