#!/usr/bin/env python3
"""Deterministic manifest and repo health checks (stdlib; uses certifi if present).

Checks: manifest JSON validity and schema basics (skill_use required),
URL liveness for docs, llms_txt, llms_full, and pages[] (llms_txt is also
content-checked: empty or HTML bodies fail), SKILL.md description length
(spec cap 1024), version alignment between SKILL.md, manifest.json, and
CHANGELOG.md, em/en-dash ban across all prose files, and references/ links
in SKILL.md, README.md, and CONTRIBUTING.md. Read-only by default; --write
adds a per-source liveness object and the top-level checked date. It never
touches names, categories, priorities, or skill_use.

Usage: python3 scripts/verify_manifest.py [--write] [--skip-network]
Exit: 0 clean, 1 findings.
"""
import json, re, ssl, sys, urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
findings = []

def note(msg):
    findings.append(msg)
    print("FINDING:", msg)

def ctx():
    c = ssl.create_default_context()
    if ssl.get_default_verify_paths().cafile is None:
        try:
            import certifi
            c = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            pass
    return c

def status(url, method="HEAD"):
    req = urllib.request.Request(url, method=method,
        headers={"User-Agent": "Mozilla/5.0 (verify_manifest)"})
    try:
        with urllib.request.urlopen(req, timeout=12, context=ctx()) as r:
            body = r.read(2048) if method == "GET" else b""
            return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception:
        return 0, b""

def llms_ok(url):
    code, body = status(url, method="GET")
    if not (200 <= code < 400):
        return code, f"HTTP {code}"
    text = body.decode("utf-8", "ignore").strip().lower()
    if not text:
        return code, "empty body"
    if text.startswith("<!doctype") or text.startswith("<html"):
        return code, "HTML shell, not llms.txt"
    return code, None

def main():
    write = "--write" in sys.argv
    network = "--skip-network" not in sys.argv
    if write and not network:
        print("NOTE: --write does nothing with --skip-network (liveness needs the network)")

    skill = (ROOT / "SKILL.md").read_text()
    desc = re.search(r"description: (.*?)\nmetadata:", skill, re.S).group(1)
    if len(desc) > 1024:
        note(f"description is {len(desc)} chars; spec cap is 1024")
    sv = re.search(r"version: ([\d.]+)", skill).group(1)

    m = json.loads((ROOT / "manifest.json").read_text())
    if m.get("version") != sv:
        note(f"version drift: SKILL.md {sv} vs manifest {m.get('version')}")
    ch = (ROOT / "CHANGELOG.md").read_text()
    if sv not in ch:
        note(f"version {sv} missing from CHANGELOG.md")

    r = json.loads((ROOT / "api-routes.json").read_text())
    rids = [x.get("id") for x in r["routes"]]
    if len(rids) != len(set(rids)):
        note("duplicate ids in api-routes")
    for x in r["routes"]:
        for k in ("id", "answers", "base", "auth"):
            if not x.get(k):
                note(f"api-routes {x.get('id','?')}: missing {k}")
        if x.get("auth") == "key" and not x.get("key_env"):
            note(f"api-routes {x['id']}: auth=key but no key_env")
    if r.get("version") != sv:
        note(f"version drift: SKILL.md {sv} vs api-routes {r.get('version')}")

    ids = [s.get("id") for s in m["sources"]]
    if len(ids) != len(set(ids)):
        note("duplicate ids in manifest")
    for s in m["sources"]:
        for k in ("id", "name", "category", "priority", "docs", "skill_use"):
            if not s.get(k):
                note(f"{s.get('id','?')}: missing {k}")

    dash_targets = list((ROOT / "references").glob("*.md")) + \
        list((ROOT / "examples").glob("*.md")) + list((ROOT / "evals").glob("*.md")) + \
        [ROOT / n for n in ("SKILL.md", "README.md", "CONTRIBUTING.md",
                            "CHANGELOG.md", "MAINTENANCE.md", "llms.txt", "manifest.json")]
    for f in dash_targets:
        if not f.exists():
            continue
        t = f.read_text()
        if "\u2014" in t or "\u2013" in t:
            note(f"em or en dash in {f.name}")

    readme = (ROOT / "README.md").read_text()
    for f in sorted((ROOT / "references").glob("*.md")):
        if f"references/{f.name}" not in readme:
            note(f"references/{f.name} missing from README structure table")

    for docname in ("SKILL.md", "README.md", "CONTRIBUTING.md"):
        text = (ROOT / docname).read_text()
        for ref in set(re.findall(r"(?:references|examples|evals|scripts)/[A-Za-z0-9_.-]+", text)):
            if ref.endswith((".md", ".py", ".json")) and not (ROOT / ref).exists():
                note(f"{docname} references missing file {ref}")

    if network:
        today = date.today().isoformat()
        for s in m["sources"]:
            urls = [("docs", s.get("docs")), ("llms_txt", s.get("llms_txt")),
                    ("llms_full", s.get("llms_full"))]
            urls += [("pages", u) for u in s.get("pages", [])]
            for field, url in urls:
                if not url:
                    continue
                if field in ("llms_txt", "llms_full"):
                    code, problem = llms_ok(url)
                    if problem:
                        note(f"{s['id']}: {field} {url}: {problem}")
                else:
                    code, _ = status(url)
                    ok = 200 <= code < 400 or code in (403, 405, 429)
                    if not ok:
                        note(f"{s['id']}: {field} {url} returned {code}")
                if write and field != "pages":
                    s["liveness"] = s.get("liveness", {})
                    s["liveness"][field] = {"code": code, "checked": today}
        if write:
            m["checked"] = today
            (ROOT / "manifest.json").write_text(json.dumps(m, indent=2))
            print(f"wrote liveness for {len(m['sources'])} sources")

    print(f"{'CLEAN' if not findings else str(len(findings)) + ' findings'}")
    sys.exit(1 if findings else 0)

if __name__ == "__main__":
    main()
