#!/usr/bin/env bash
# Validate the PolyRobin skill definition and default-parameters reference.
# - Checks SKILL.md has YAML frontmatter with all required fields.
# - Checks examples/default-parameters.yaml parses as YAML and stays in-band.
# Exits non-zero on any failure so CI can gate on it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL="$ROOT/SKILL.md"
CONFIG="$ROOT/examples/default-parameters.yaml"

fail() { echo "❌ $1" >&2; exit 1; }
pass() { echo "✅ $1"; }

[ -f "$SKILL" ]  || fail "SKILL.md not found at $SKILL"
[ -f "$CONFIG" ] || fail "examples/default-parameters.yaml not found at $CONFIG"

PY="$(command -v python3 || command -v python || true)"
[ -n "$PY" ] || fail "python3 (or python) is required to validate YAML"

"$PY" - "$SKILL" "$CONFIG" <<'PYEOF'
import sys, re

skill_path, config_path = sys.argv[1], sys.argv[2]

try:
    import yaml
except ImportError:
    print("❌ PyYAML is required: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

# --- SKILL.md frontmatter ---------------------------------------------------
text = open(skill_path, encoding="utf-8").read()
m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
if not m:
    print("❌ SKILL.md is missing YAML frontmatter (--- ... ---)", file=sys.stderr)
    sys.exit(1)

try:
    fm = yaml.safe_load(m.group(1))
except yaml.YAMLError as e:
    print(f"❌ SKILL.md frontmatter is not valid YAML: {e}", file=sys.stderr)
    sys.exit(1)

required = ["name", "description", "tags", "version", "author"]
missing = [k for k in required if k not in fm or fm[k] in (None, "", [])]
if missing:
    print(f"❌ SKILL.md frontmatter missing required fields: {missing}", file=sys.stderr)
    sys.exit(1)

if fm["name"] != "PolyRobin":
    print(f"❌ Expected name 'PolyRobin', got {fm['name']!r}", file=sys.stderr)
    sys.exit(1)

if not isinstance(fm["tags"], list) or len(fm["tags"]) < 3:
    print("❌ 'tags' must be a list of at least 3 entries", file=sys.stderr)
    sys.exit(1)

if not re.match(r"^\d+\.\d+\.\d+$", str(fm["version"])):
    print(f"❌ 'version' must be semver (x.y.z), got {fm['version']!r}", file=sys.stderr)
    sys.exit(1)

print(f"✅ SKILL.md frontmatter OK (name={fm['name']}, version={fm['version']}, tags={len(fm['tags'])})")

# --- Required sections ------------------------------------------------------
body = text[m.end():]
for heading in ["Overview", "Safety Model", "Supported Markets",
                "Example Commands", "Integration Hooks", "Edge Cases",
                "Auditability"]:
    if not re.search(rf"^#+\s+.*{re.escape(heading)}", body, re.MULTILINE):
        print(f"❌ SKILL.md missing required section: {heading}", file=sys.stderr)
        sys.exit(1)
print("✅ SKILL.md has all required sections")

# --- Sample config ----------------------------------------------------------
try:
    cfg = yaml.safe_load(open(config_path, encoding="utf-8"))
except yaml.YAMLError as e:
    print(f"❌ examples/default-parameters.yaml is not valid YAML: {e}", file=sys.stderr)
    sys.exit(1)

for key in ["risk", "venues", "rails", "execution"]:
    if key not in cfg:
        print(f"❌ examples/default-parameters.yaml missing top-level key: {key}", file=sys.stderr)
        sys.exit(1)
print("✅ examples/default-parameters.yaml parses and has expected keys")

# --- Config values must sit inside the SAFE gate bands ----------------------
# Loosening a gate beyond its safe band should require a deliberate, loud override
# — the sample config must never ship outside these bounds.
risk = cfg.get("risk", {}) or {}
# key: (min_inclusive, max_inclusive, human label)
bands = {
    "daily_loss_limit":     (0.0, 0.10, "gate 1 daily loss limit"),
    "max_per_market":       (0.0, 0.25, "gate 2 max per market"),
    "max_per_category":     (0.0, 0.50, "gate 3 max per category"),
    "conviction_threshold": (50,  100,  "gate 4a conviction threshold"),
    "min_edge":             (0.01, 1.0, "gate 4b min edge"),
    "total_deployed_cap":   (0.0, 0.90, "gate 6 total deployed cap"),
    "min_liquidity_usd":    (10000, 10**9, "gate 7 liquidity floor"),
    "min_volume_usd":       (50000, 10**9, "gate 7 volume floor"),
    "kelly_fraction":       (0.0, 0.5,  "fractional Kelly"),
}
errors = []
for k, (lo, hi, label) in bands.items():
    if k not in risk:
        errors.append(f"risk.{k} ({label}) is missing")
        continue
    v = risk[k]
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        errors.append(f"risk.{k} ({label}) must be a number, got {v!r}")
    elif not (lo <= v <= hi):
        errors.append(f"risk.{k} ({label})={v} is outside the safe band [{lo}, {hi}]")

# Gate 5 (confirmation) can never be disabled in the shipped config.
if risk.get("confirm_all_material_actions") is not True:
    errors.append("risk.confirm_all_material_actions (gate 5) MUST be true — it cannot be disabled")

if errors:
    for e in errors:
        print(f"❌ {e}", file=sys.stderr)
    sys.exit(1)
print("✅ config risk values are within safe gate bands (gate 5 locked on)")

# --- Sample Rationale Card must be valid & well-formed ----------------------
import json, os
rc_path = os.path.join(os.path.dirname(config_path), "rationale-card.json")
if os.path.exists(rc_path):
    try:
        rc = json.load(open(rc_path, encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"❌ examples/rationale-card.json is not valid JSON: {e}", file=sys.stderr)
        sys.exit(1)
    gates = rc.get("gates")
    if not isinstance(gates, list) or len(gates) != 7:
        print("❌ rationale-card.json must document all 7 gates", file=sys.stderr)
        sys.exit(1)
    g5 = next((g for g in gates if g.get("id") == 5), None)
    if not g5 or "onfirmation" not in str(g5.get("name", "")):
        print("❌ rationale-card.json gate 5 must be the confirmation gate", file=sys.stderr)
        sys.exit(1)
    print("✅ examples/rationale-card.json is valid (7 gates, confirmation gate present)")
else:
    print("ℹ️  examples/rationale-card.json not found — skipping sample-output check")
PYEOF

pass "All validations passed"
