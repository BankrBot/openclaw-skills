#!/usr/bin/env bash
# Boundary markers wrapping API responses (DIS-83). Sourced by opensea-get.sh
# and opensea-post.sh. Markers always go to stderr so stdout stays valid JSON
# for `| jq` pipelines; the body is written to the function's stdout, which
# the caller redirects to stderr in error paths.
#
# Usage:
#   emit_response "$tmp_body"        # success path — body to stdout
#   emit_response "$tmp_body" >&2    # error path — body to stderr

emit_response() {
  echo "--- BEGIN OPENSEA API RESPONSE ---" >&2
  cat "$1"
  printf '\n'
  echo "--- END OPENSEA API RESPONSE ---" >&2
}
