#!/usr/bin/env bash
# Scan for secret values from .env.local.
#   --staged : scan files staged for commit (used by .githooks/pre-commit)
#   (none)   : scan every tracked file in the repo
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
env_file="$root/.env.local"
[ -f "$env_file" ] || exit 0

mode="${1:-}"
found=0
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  value="${value%\"}"; value="${value#\"}"
  # Only look for values long enough to be secrets (skip short/default settings).
  [ "${#value}" -ge 16 ] || continue
  case "$key" in EMAIL_FROM|GEMINI_MODEL|BRIEF_RECIPIENTS) continue ;; esac
  if [ "$mode" = "--staged" ]; then
    hits="$(git diff --cached --name-only -z --diff-filter=ACMR | xargs -0 -r grep -lF -- "$value" 2>/dev/null || true)"
  else
    hits="$(git grep -lF -- "$value" 2>/dev/null || true)"
  fi
  if [ -n "$hits" ]; then
    echo "✖ Secret value of $key found in:" >&2
    echo "$hits" | sed 's/^/    /' >&2
    found=1
  fi
done < "$env_file"

if [ "$found" -ne 0 ]; then
  echo "Commit aborted: remove the secret(s) above." >&2
  exit 1
fi
echo "✓ No .env.local secret values found${mode:+ in staged files}."
