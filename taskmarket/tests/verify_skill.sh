#!/usr/bin/env bash
# Safeguard tests for the taskmarket skill.
# A Bankr skill is documentation-driven, so the meaningful tests are contract
# checks: the safety gates must be present, the catalog must parse, and the
# references must resolve. Run from the skill folder:  bash tests/verify_skill.sh
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "FAIL: $1" >&2; exit 1; }

# catalog.json must be valid JSON with the required install fields
if command -v node >/dev/null 2>&1; then
  node -e 'const c=require("./catalog.json");if(c.slug!=="taskmarket"||c.install.repoPath!=="taskmarket"||!c.providerUrl.includes("taskmarket.dev"))process.exit(1)' \
    || fail "catalog.json invalid"
elif command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1; then
  PY="$(command -v python3 || command -v python)"
  "$PY" - <<'EOF' || fail "catalog.json invalid"
import json
c = json.load(open("catalog.json"))
assert c["slug"] == "taskmarket"
assert c["install"]["repoPath"] == "taskmarket"
assert "taskmarket.dev" in c["providerUrl"]
EOF
else
  fail "no JSON runtime (node or python) available"
fi

# SKILL.md must carry every mandatory safety gate
gate() { grep -qi "$1" SKILL.md || fail "SKILL.md missing gate: $2"; }
gate "fresh, explicit"              "authorization gate"
gate "maximum spend"                "max spend echo"
gate "Base"                         "Base network stated"
gate "never blindly retry"          "no blind payment retry"
gate "never silently accept"        "human review of submissions"
gate "never reads, stores, logs"    "no-secrets contract"

# references must exist and not dangle
grep -q "references/cli-reference.md" SKILL.md || fail "SKILL.md missing reference link"
test -f references/cli-reference.md || fail "references/cli-reference.md missing"

echo "OK: catalog parses, all 6 safety gates present, references resolve"
